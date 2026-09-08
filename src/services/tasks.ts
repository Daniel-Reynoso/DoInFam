import { supabase } from '@/supabase';
import type { Enums, Tables } from '@/types/database';
import type { Task, TaskStatus } from '@/types';
import { getHomeSummary } from './home';

type JsonObject = Record<string, unknown>;
type TaskRecord = Pick<Tables<'tasks'>, 'id' | 'title' | 'description' | 'points' | 'recurrence' | 'quota_per_period' | 'is_active'>;

export type TaskEditorValue = {
  id: string;
  title: string;
  description: string;
  points: number;
  recurrence: Enums<'task_recurrence'>;
  quotaPerPeriod: number;
  isActive: boolean;
};

export type TaskListItem = Task & TaskEditorValue;
export type SaveTaskInput = Omit<TaskEditorValue, 'id' | 'isActive'>;

export type CompleteTaskResult =
  | {
      ok: true;
      completionId: string;
      taskId: string;
      pointsAwarded: number;
      remainingQuota: number;
      isLastSlot: boolean;
      periodEndsAt: string;
      currentWeekPoints: number;
      weeklyGoal: number;
      goalReachedNow: boolean;
    }
  | {
      ok: false;
      code: 'QUOTA_EXHAUSTED' | 'TASK_ALREADY_DONE_TODAY';
      taskId: string;
      remainingQuota: number;
      periodEndsAt: string;
    }
  | {
      ok: false;
      code: 'MEMBER_RESTING';
      taskId: string;
    };

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertOk(data: unknown) {
  if (!isObject(data) || data.ok !== true) throw new Error('Respuesta inválida del servidor.');
}

function requiredString(value: unknown, field: string) {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`Respuesta inválida del servidor: ${field}.`);
  return value;
}

function requiredNumber(value: unknown, field: string) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Respuesta inválida del servidor: ${field}.`);
  return value;
}

function periodName(recurrence: Enums<'task_recurrence'>) {
  return recurrence === 'daily' ? 'día' : recurrence === 'monthly' ? 'mes' : 'semana';
}

export async function listTasks(): Promise<TaskListItem[]> {
  const [recordsResult, summary] = await Promise.all([
    supabase.from('tasks').select('id, title, description, points, recurrence, quota_per_period, is_active').order('created_at', { ascending: false }),
    getHomeSummary(),
  ]);
  if (recordsResult.error) throw recordsResult.error;
  const activeState = new Map(summary.tasks.map((task) => [task.id, task]));

  return (recordsResult.data as TaskRecord[]).map((record) => {
    const live = activeState.get(record.id);
    const status: TaskStatus = record.is_active ? (live?.status ?? 'available') : 'inactive';
    return {
      id: record.id,
      title: record.title,
      description: record.description ?? '',
      points: record.points,
      recurrence: record.recurrence,
      quotaPerPeriod: record.quota_per_period,
      isActive: record.is_active,
      quotaLabel: live?.quotaLabel ?? `${record.quota_per_period} por ${periodName(record.recurrence)}`,
      status,
    };
  });
}

export async function getTask(taskId: string): Promise<TaskEditorValue> {
  const { data, error } = await supabase.from('tasks').select('id, title, description, points, recurrence, quota_per_period, is_active').eq('id', taskId).single();
  if (error) throw error;
  return { id: data.id, title: data.title, description: data.description ?? '', points: data.points, recurrence: data.recurrence, quotaPerPeriod: data.quota_per_period, isActive: data.is_active };
}

export async function createTask(input: SaveTaskInput) {
  const { data, error } = await supabase.rpc('create_task', { p_title: input.title.trim(), p_description: input.description.trim(), p_points: input.points, p_recurrence: input.recurrence, p_quota_per_period: input.quotaPerPeriod });
  if (error) throw error;
  assertOk(data);
}

export async function updateTask(taskId: string, input: SaveTaskInput) {
  const { data, error } = await supabase.rpc('update_task', { p_task_id: taskId, p_title: input.title.trim(), p_description: input.description.trim(), p_points: input.points, p_recurrence: input.recurrence, p_quota_per_period: input.quotaPerPeriod });
  if (error) throw error;
  assertOk(data);
}

export async function deactivateTask(taskId: string) {
  const { data, error } = await supabase.rpc('deactivate_task', { p_task_id: taskId });
  if (error) throw error;
  assertOk(data);
}

export async function completeTask(taskId: string): Promise<CompleteTaskResult> {
  const { data, error } = await supabase.rpc('complete_task', { p_task_id: taskId });
  if (error) throw error;
  if (!isObject(data)) throw new Error('Respuesta inválida al completar la tarea.');

  if (data.ok === false && data.code === 'MEMBER_RESTING') {
    return {
      ok: false,
      code: 'MEMBER_RESTING',
      taskId: requiredString(data.task_id, 'task_id'),
    };
  }

  if (data.ok === false && (data.code === 'QUOTA_EXHAUSTED' || data.code === 'TASK_ALREADY_DONE_TODAY')) {
    return {
      ok: false,
      code: data.code,
      taskId: requiredString(data.task_id, 'task_id'),
      remainingQuota: requiredNumber(data.remaining_quota, 'remaining_quota'),
      periodEndsAt: requiredString(data.period_ends_at, 'period_ends_at'),
    };
  }

  if (data.ok !== true) throw new Error('Respuesta inválida al completar la tarea.');
  return {
    ok: true,
    completionId: requiredString(data.completion_id, 'completion_id'),
    taskId: requiredString(data.task_id, 'task_id'),
    pointsAwarded: requiredNumber(data.points_awarded, 'points_awarded'),
    remainingQuota: requiredNumber(data.remaining_quota, 'remaining_quota'),
    isLastSlot: data.is_last_slot === true,
    periodEndsAt: requiredString(data.period_ends_at, 'period_ends_at'),
    currentWeekPoints: requiredNumber(data.current_week_points, 'current_week_points'),
    weeklyGoal: requiredNumber(data.weekly_goal, 'weekly_goal'),
    goalReachedNow: data.goal_reached_now === true,
  };
}

export async function deleteTaskCompletion(completionId: string) {
  const { data, error } = await supabase.rpc('delete_task_completion', { p_completion_id: completionId });
  if (error) throw error;
  assertOk(data);
}
