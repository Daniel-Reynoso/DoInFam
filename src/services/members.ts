import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/supabase';
import type { Tables } from '@/types/database';

export type FamilyMemberRecord = Pick<
  Tables<'family_members'>,
  'id' | 'name' | 'avatar_key'
>;

export type FamilyRoster = {
  familyId: string;
  familyName: string;
  inviteCode: string;
  members: FamilyMemberRecord[];
};

export type ActiveMember = {
  id: string;
  name: string;
  avatarKey: string;
  absoluteExpiresAt: string;
};

export type MemberPinResult =
  | { ok: true }
  | {
      ok: false;
      code: 'INVALID_PIN';
      attemptsRemaining: number;
    }
  | {
      ok: false;
      code: 'PIN_LOCKED';
      retryAfterSeconds: number;
    };

type JsonObject = Record<string, unknown>;

const lastMemberKey = (familyId: string) => `doinfam:last-member:${familyId}`;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Respuesta inválida del servidor: ${field}.`);
  }
  return value;
}

export async function getFamilyRoster(): Promise<FamilyRoster> {
  const accessResult = await supabase
    .from('family_auth_accounts')
    .select('family_id')
    .maybeSingle();

  if (accessResult.error) throw accessResult.error;
  if (!accessResult.data) throw new Error('FAMILY_NOT_CONFIGURED');

  const familyId = accessResult.data.family_id;
  const [familyResult, membersResult] = await Promise.all([
    supabase.from('families').select('id, name, invite_code').eq('id', familyId).single(),
    supabase
      .from('family_members')
      .select('id, name, avatar_key')
      .eq('family_id', familyId)
      .eq('is_active', true)
      .order('created_at', { ascending: true }),
  ]);

  if (familyResult.error) throw familyResult.error;
  if (membersResult.error) throw membersResult.error;

  return {
    familyId: familyResult.data.id,
    familyName: familyResult.data.name,
    inviteCode: familyResult.data.invite_code,
    members: membersResult.data ?? [],
  };
}

export async function getRememberedMemberId(familyId: string) {
  return AsyncStorage.getItem(lastMemberKey(familyId));
}

export async function rememberMember(familyId: string, memberId: string) {
  await AsyncStorage.setItem(lastMemberKey(familyId), memberId);
}

export async function selectMemberWithPin(
  memberId: string,
  pin: string,
): Promise<MemberPinResult> {
  const { data, error } = await supabase.rpc('select_member', {
    p_member_id: memberId,
    p_pin: pin,
  });

  if (error) throw error;
  if (!isObject(data)) throw new Error('Respuesta inválida al validar el PIN.');

  if (data.ok === true) return { ok: true };
  if (data.code === 'PIN_LOCKED') {
    return {
      ok: false,
      code: 'PIN_LOCKED',
      retryAfterSeconds:
        typeof data.retry_after_seconds === 'number' ? data.retry_after_seconds : 120,
    };
  }

  return {
    ok: false,
    code: 'INVALID_PIN',
    attemptsRemaining:
      typeof data.attempts_remaining === 'number' ? data.attempts_remaining : 0,
  };
}

export async function getActiveMember(): Promise<ActiveMember | null> {
  const { data, error } = await supabase.rpc('get_active_member');
  if (error) throw error;
  if (!isObject(data) || data.ok !== true) {
    throw new Error('Respuesta inválida al consultar el integrante activo.');
  }
  if (data.active !== true) return null;
  if (!isObject(data.member)) {
    throw new Error('Respuesta inválida al consultar el integrante activo.');
  }

  return {
    id: requiredString(data.member.id, 'member.id'),
    name: requiredString(data.member.name, 'member.name'),
    avatarKey: requiredString(data.member.avatar_key, 'member.avatar_key'),
    absoluteExpiresAt: requiredString(data.absolute_expires_at, 'absolute_expires_at'),
  };
}

export async function clearActiveMember() {
  const { error } = await supabase.rpc('clear_active_member');
  if (error) throw error;
}
