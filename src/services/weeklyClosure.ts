import { supabase } from '@/supabase';

type JsonObject = Record<string, unknown>;

export type WeeklyClosureTask = {
  id: string;
  title: string;
  points: number;
  completedAt: string;
};

export type WeeklyClosure = {
  weekStart: string;
  memberName: string;
  earnedPoints: number;
  targetPoints: number;
  pointsMissing: number;
  goalReached: boolean;
  consequence: string | null;
  taskCount: number;
  topTasks: WeeklyClosureTask[];
};

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Respuesta inválida del servidor: ${field}.`);
  }
  return value;
}

function numberOrZero(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function taskFromJson(value: unknown): WeeklyClosureTask {
  if (!isObject(value)) throw new Error('Respuesta inválida del servidor: top_tasks.');
  return {
    id: requiredString(value.id, 'top_tasks.id'),
    title: requiredString(value.title, 'top_tasks.title'),
    points: numberOrZero(value.points),
    completedAt: requiredString(value.completed_at, 'top_tasks.completed_at'),
  };
}

export async function getPendingWeeklyClosure(): Promise<WeeklyClosure | null> {
  const { data, error } = await supabase.rpc('get_pending_weekly_closure');
  if (error) throw error;
  if (!isObject(data) || data.ok !== true) throw new Error('Respuesta inválida al revisar cierre semanal.');
  if (data.has_pending !== true) return null;

  const topTasks = Array.isArray(data.top_tasks) ? data.top_tasks.map(taskFromJson) : [];
  return {
    weekStart: requiredString(data.week_start, 'week_start'),
    memberName: requiredString(data.member_name, 'member_name'),
    earnedPoints: numberOrZero(data.earned_points),
    targetPoints: numberOrZero(data.target_points),
    pointsMissing: numberOrZero(data.points_missing),
    goalReached: data.goal_reached === true,
    consequence: typeof data.consequence === 'string' && data.consequence.length > 0 ? data.consequence : null,
    taskCount: numberOrZero(data.task_count),
    topTasks,
  };
}

export async function markWeeklyClosureSeen(weekStart: string) {
  const { data, error } = await supabase.rpc('mark_weekly_closure_seen', { p_week_start: weekStart });
  if (error) throw error;
  if (!isObject(data) || data.ok !== true) throw new Error('No pudimos cerrar el resumen semanal.');
}
