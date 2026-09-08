import { supabase } from '@/supabase';
import type { Task } from '@/types';

type JsonObject = Record<string, unknown>;

export type HomeSummary = {
  memberId: string;
  weekStart: string;
  points: number;
  goal: number;
  pointsRemaining: number;
  weekEndsAt: string;
  daysLeft: number;
  isResting: boolean;
  restDuration: 'this_week' | 'until_disabled' | null;
  restEndsAt: string | null;
  tasks: Task[];
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

function requiredNumber(value: unknown, field: string) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Respuesta inválida del servidor: ${field}.`);
  }
  return value;
}

function taskFromJson(value: unknown): Task {
  if (!isObject(value)) throw new Error('Respuesta inválida del servidor: task.');

  const quota = requiredNumber(value.quota_per_period, 'task.quota_per_period');
  const remaining = requiredNumber(value.remaining_quota, 'task.remaining_quota');
  const recurrence = requiredString(value.recurrence, 'task.recurrence');
  const periodLabel = recurrence === 'daily' ? 'hoy' : recurrence === 'monthly' ? 'mes' : 'semana';

  return {
    id: requiredString(value.id, 'task.id'),
    title: requiredString(value.title, 'task.title'),
    points: requiredNumber(value.points, 'task.points'),
    quotaLabel: `${quota - remaining}/${quota} ${periodLabel}`,
    status: value.is_done_today === true ? 'done-today' : value.is_exhausted === true ? 'exhausted' : value.is_last_slot === true ? 'last-slot' : 'available',
  };
}

function calculateDaysLeft(weekEndsAt: string) {
  const remainingMs = new Date(weekEndsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(remainingMs / 86_400_000));
}

export async function getHomeSummary(): Promise<HomeSummary> {
  const { data, error } = await supabase.rpc('get_home_summary');

  if (error) throw error;
  if (!isObject(data) || data.ok !== true || !Array.isArray(data.tasks)) {
    throw new Error('Respuesta inválida al cargar Inicio.');
  }

  const weekEndsAt = requiredString(data.week_ends_at, 'week_ends_at');
  return {
    memberId: requiredString(data.member_id, 'member_id'),
    weekStart: requiredString(data.week_start, 'week_start'),
    points: requiredNumber(data.points, 'points'),
    goal: requiredNumber(data.goal, 'goal'),
    pointsRemaining: requiredNumber(data.points_remaining, 'points_remaining'),
    weekEndsAt,
    daysLeft: calculateDaysLeft(weekEndsAt),
    isResting: data.is_resting === true,
    restDuration: data.rest_duration === 'this_week' || data.rest_duration === 'until_disabled' ? data.rest_duration : null,
    restEndsAt: typeof data.rest_ends_at === 'string' ? data.rest_ends_at : null,
    tasks: data.tasks.map(taskFromJson),
  };
}
