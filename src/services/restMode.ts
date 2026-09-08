import { supabase } from '@/supabase';

type JsonObject = Record<string, unknown>;

export type RestDuration = 'this_week' | 'until_disabled';

export type RestMode = {
  active: boolean;
  duration: RestDuration | null;
  startedAt: string | null;
  endsAt: string | null;
};

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseRestMode(data: unknown): RestMode {
  if (!isObject(data) || data.ok !== true || typeof data.active !== 'boolean') {
    throw new Error('Respuesta inválida al cargar el modo descanso.');
  }

  const duration = data.duration === 'this_week' || data.duration === 'until_disabled'
    ? data.duration
    : null;

  return {
    active: data.active,
    duration,
    startedAt: typeof data.started_at === 'string' ? data.started_at : null,
    endsAt: typeof data.ends_at === 'string' ? data.ends_at : null,
  };
}

export async function getRestMode(): Promise<RestMode> {
  const { data, error } = await supabase.rpc('get_rest_mode');
  if (error) throw error;
  return parseRestMode(data);
}

export async function enableRestMode(duration: RestDuration): Promise<RestMode> {
  const { data, error } = await supabase.rpc('set_rest_mode', { p_duration: duration });
  if (error) throw error;
  return parseRestMode(data);
}

export async function disableRestMode(): Promise<RestMode> {
  const { data, error } = await supabase.rpc('disable_rest_mode');
  if (error) throw error;
  return parseRestMode(data);
}
