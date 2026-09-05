import { supabase } from '@/supabase';

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertOk(data: unknown, fallbackMessage: string) {
  if (!isObject(data) || data.ok !== true) throw new Error(fallbackMessage);
}

export async function setWeeklyGoal(targetPoints: number) {
  const { data, error } = await supabase.rpc('set_weekly_goal', { p_target_points: targetPoints });
  if (error) throw error;
  assertOk(data, 'No pudimos guardar la meta semanal.');
}

export async function setWeeklyConsequence(consequence: string) {
  const { data, error } = await supabase.rpc('set_weekly_consequence', { p_consequence: consequence });
  if (error) throw error;
  assertOk(data, 'No pudimos guardar la consecuencia semanal.');
}

export async function updateActiveMemberProfile(name: string, avatarKey: string) {
  const { data, error } = await supabase.rpc('update_member_profile', {
    p_name: name.trim(),
    p_avatar_key: avatarKey,
  });
  if (error) throw error;
  assertOk(data, 'No pudimos guardar tu perfil.');
}

export async function updateFamilyName(name: string) {
  const { data, error } = await supabase.rpc('update_family_settings', {
    p_name: name.trim(),
  });
  if (error) throw error;
  assertOk(data, 'No pudimos guardar el nombre de la familia.');
}
