import { supabase } from '@/supabase';
import type { AvatarKey } from '@/theme';

type JsonObject = Record<string, unknown>;

export type CreateFamilyInput = {
  familyName: string;
  firstMemberName: string;
  pin: string;
  weeklyGoal: number;
  avatarKey: AvatarKey;
};

export type CreateFamilyResult = {
  familyId: string;
  memberId: string;
  weekStart: string;
  inviteCode?: string;
};

export type JoinFamilyResult = {
  familyId: string;
  familyName: string;
};

export type CreateMemberProfileInput = {
  name: string;
  pin: string;
  weeklyGoal: number;
  avatarKey: AvatarKey;
};

export type CreateMemberProfileResult = {
  familyId: string;
  memberId: string;
  weekStart: string;
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

export async function createFamily(input: CreateFamilyInput): Promise<CreateFamilyResult> {
  const { data, error } = await supabase.rpc('create_family', {
    p_family_name: input.familyName.trim(),
    p_first_member_name: input.firstMemberName.trim(),
    p_pin: input.pin,
    p_weekly_goal: input.weeklyGoal,
    p_avatar_key: input.avatarKey,
  });

  if (error) throw error;
  if (!isObject(data) || data.ok !== true) {
    throw new Error('No pudimos crear la familia. Inténtalo nuevamente.');
  }

  return {
    familyId: requiredString(data.family_id, 'family_id'),
    memberId: requiredString(data.member_id, 'member_id'),
    weekStart: requiredString(data.week_start, 'week_start'),
    inviteCode: typeof data.invite_code === 'string' ? data.invite_code : undefined,
  };
}

export async function joinFamilyByCode(code: string): Promise<JoinFamilyResult> {
  const { data, error } = await supabase.rpc('join_family_by_code', {
    p_invite_code: code.trim(),
  });

  if (error) throw error;
  if (!isObject(data) || data.ok !== true) {
    throw new Error('No pudimos unir esta cuenta a la familia.');
  }

  return {
    familyId: requiredString(data.family_id, 'family_id'),
    familyName: requiredString(data.family_name, 'family_name'),
  };
}

export async function createMemberProfile(
  input: CreateMemberProfileInput,
): Promise<CreateMemberProfileResult> {
  const { data, error } = await supabase.rpc('create_member_profile', {
    p_name: input.name.trim(),
    p_pin: input.pin,
    p_weekly_goal: input.weeklyGoal,
    p_avatar_key: input.avatarKey,
  });

  if (error) throw error;
  if (!isObject(data) || data.ok !== true) {
    throw new Error('No pudimos crear tu perfil. Inténtalo nuevamente.');
  }

  return {
    familyId: requiredString(data.family_id, 'family_id'),
    memberId: requiredString(data.member_id, 'member_id'),
    weekStart: requiredString(data.week_start, 'week_start'),
  };
}
