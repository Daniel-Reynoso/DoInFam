import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/supabase';
import type { Database } from '@/types/database';

type JsonObject = Record<string, unknown>;

export type PinRecoveryAccess = {
  canResetPins: boolean;
  isFamilyAdmin: boolean;
  email: string | null;
};

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function getPinRecoveryAccess(): Promise<PinRecoveryAccess> {
  const [{ data, error }, sessionResult] = await Promise.all([
    supabase.rpc('get_pin_recovery_access'),
    supabase.auth.getSession(),
  ]);
  if (error) throw error;
  if (sessionResult.error) throw sessionResult.error;
  if (!isObject(data) || data.ok !== true) throw new Error('PIN_RECOVERY_STATUS_INVALID');

  return {
    canResetPins: data.can_reset_pins === true,
    isFamilyAdmin: data.is_family_admin === true,
    email: sessionResult.data.session?.user.email ?? null,
  };
}

export async function verifyAdminAndAuthorizeMemberPinReset(
  memberId: string,
  password: string,
) {
  const sessionResult = await supabase.auth.getSession();
  if (sessionResult.error) throw sessionResult.error;
  const currentUser = sessionResult.data.session?.user;
  if (!currentUser?.email) throw new Error('ADMIN_EMAIL_REQUIRED');

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey) throw new Error('SUPABASE_CONFIG_MISSING');

  const verifier = createClient<Database>(supabaseUrl, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  try {
    const signInResult = await verifier.auth.signInWithPassword({
      email: currentUser.email,
      password,
    });
    if (signInResult.error) throw new Error('ADMIN_PASSWORD_INVALID');
    if (signInResult.data.user?.id !== currentUser.id) throw new Error('ADMIN_ACCOUNT_MISMATCH');

    const { data, error } = await verifier.rpc('authorize_member_pin_reset', {
      p_member_id: memberId,
    });
    if (error) throw error;
    if (!isObject(data) || data.ok !== true) throw new Error('PIN_RESET_AUTHORIZATION_FAILED');
  } finally {
    await verifier.auth.signOut({ scope: 'local' }).catch(() => undefined);
  }
}

export async function getMemberPinResetStatus(memberId: string) {
  const { data, error } = await supabase.rpc('get_member_pin_reset_status', {
    p_member_id: memberId,
  });
  if (error) throw error;
  if (!isObject(data) || data.ok !== true) throw new Error('PIN_RESET_STATUS_INVALID');
  return {
    canCreatePin: data.can_create_pin === true,
    expiresAt: typeof data.expires_at === 'string' ? data.expires_at : null,
  };
}

export async function completeMemberPinReset(memberId: string, newPin: string) {
  const { data, error } = await supabase.rpc('complete_member_pin_reset', {
    p_member_id: memberId,
    p_new_pin: newPin,
  });
  if (error) throw error;
  if (!isObject(data) || data.ok !== true) throw new Error('PIN_RESET_FAILED');
}
