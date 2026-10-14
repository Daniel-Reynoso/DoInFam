import { supabase } from '@/supabase';
import type { Enums } from '@/types/database';

type JsonObject = Record<string, unknown>;

export type PastTaskUnavailableReason = 'QUOTA_EXHAUSTED' | 'TASK_ALREADY_DONE_ON_DATE';

export type PastTaskOption = {
  id: string;
  title: string;
  description: string;
  points: number;
  recurrence: Enums<'task_recurrence'>;
  quotaPerPeriod: number;
  remainingQuota: number;
  isAvailable: boolean;
  unavailableReason: PastTaskUnavailableReason | null;
  periodEndsAt: string;
};

export type CompletePastTaskResult =
  | {
      ok: true;
      completionId: string;
      taskId: string;
      completionDate: string;
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
      code: 'QUOTA_EXHAUSTED' | 'TASK_ALREADY_DONE_ON_DATE';
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

function requiredString(value: unknown, field: string) {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`Respuesta inválida del servidor: ${field}.`);
  return value;
}

function requiredNumber(value: unknown, field: string) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Respuesta inválida del servidor: ${field}.`);
  return value;
}

function parseTask(value: unknown): PastTaskOption {
  if (!isObject(value)) throw new Error('Respuesta inválida al cargar las tareas pasadas.');
  const recurrence = value.recurrence;
  if (recurrence !== 'daily' && recurrence !== 'weekly' && recurrence !== 'monthly') {
    throw new Error('Respuesta inválida del servidor: recurrence.');
  }
  const reason = value.unavailable_reason;
  if (reason !== null && reason !== 'QUOTA_EXHAUSTED' && reason !== 'TASK_ALREADY_DONE_ON_DATE') {
    throw new Error('Respuesta inválida del servidor: unavailable_reason.');
  }
  return {
    id: requiredString(value.id, 'id'),
    title: requiredString(value.title, 'title'),
    description: typeof value.description === 'string' ? value.description : '',
    points: requiredNumber(value.points, 'points'),
    recurrence,
    quotaPerPeriod: requiredNumber(value.quota_per_period, 'quota_per_period'),
    remainingQuota: requiredNumber(value.remaining_quota, 'remaining_quota'),
    isAvailable: value.is_available === true,
    unavailableReason: reason,
    periodEndsAt: requiredString(value.period_ends_at, 'period_ends_at'),
  };
}

export async function listPastTaskOptions(completionDate: string): Promise<PastTaskOption[]> {
  const { data, error } = await supabase.rpc('get_past_task_options', { p_completion_date: completionDate });
  if (error) throw error;
  if (!isObject(data)) throw new Error('Respuesta inválida al cargar las tareas pasadas.');
  if (data.ok === false && data.code === 'MEMBER_RESTING') return [];
  if (data.ok !== true || !Array.isArray(data.tasks)) throw new Error('Respuesta inválida al cargar las tareas pasadas.');
  return data.tasks.map(parseTask);
}

export async function completePastTask(taskId: string, completionDate: string): Promise<CompletePastTaskResult> {
  const { data, error } = await supabase.rpc('complete_past_task', {
    p_task_id: taskId,
    p_completion_date: completionDate,
  });
  if (error) throw error;
  if (!isObject(data)) throw new Error('Respuesta inválida al registrar la tarea pasada.');

  if (data.ok === false && data.code === 'MEMBER_RESTING') {
    return { ok: false, code: 'MEMBER_RESTING', taskId: requiredString(data.task_id, 'task_id') };
  }

  if (data.ok === false && (data.code === 'QUOTA_EXHAUSTED' || data.code === 'TASK_ALREADY_DONE_ON_DATE')) {
    return {
      ok: false,
      code: data.code,
      taskId: requiredString(data.task_id, 'task_id'),
      remainingQuota: requiredNumber(data.remaining_quota, 'remaining_quota'),
      periodEndsAt: requiredString(data.period_ends_at, 'period_ends_at'),
    };
  }

  if (data.ok !== true) throw new Error('Respuesta inválida al registrar la tarea pasada.');
  return {
    ok: true,
    completionId: requiredString(data.completion_id, 'completion_id'),
    taskId: requiredString(data.task_id, 'task_id'),
    completionDate: requiredString(data.completion_date, 'completion_date'),
    pointsAwarded: requiredNumber(data.points_awarded, 'points_awarded'),
    remainingQuota: requiredNumber(data.remaining_quota, 'remaining_quota'),
    isLastSlot: data.is_last_slot === true,
    periodEndsAt: requiredString(data.period_ends_at, 'period_ends_at'),
    currentWeekPoints: requiredNumber(data.current_week_points, 'current_week_points'),
    weeklyGoal: requiredNumber(data.weekly_goal, 'weekly_goal'),
    goalReachedNow: data.goal_reached_now === true,
  };
}
