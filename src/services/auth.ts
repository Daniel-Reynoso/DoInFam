import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/supabase';

export type FamilySignUpResult = {
  session: Session | null;
  requiresEmailConfirmation: boolean;
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

function validateCredentials(email: string, password: string) {
  const normalizedEmail = normalizeEmail(email);
  if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
    throw new Error('Ingresa un correo válido.');
  }
  if (password.length < 8) {
    throw new Error('La contraseña debe tener al menos 8 caracteres.');
  }
  return normalizedEmail;
}

export async function signUpFamilyAccount(
  email: string,
  password: string,
): Promise<FamilySignUpResult> {
  const normalizedEmail = validateCredentials(email, password);
  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
  });

  if (error) throw error;

  return {
    session: data.session,
    requiresEmailConfirmation: data.session === null,
  };
}

export async function signInFamilyAccount(email: string, password: string) {
  const normalizedEmail = validateCredentials(email, password);
  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });

  if (error) throw error;
  return data.session;
}

export async function signInAnonymousFamilyAccess() {
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  if (!data.session) throw new Error('No pudimos crear una sesión para este dispositivo.');
  return data.session;
}

export async function signOutFamilyAccount() {
  // Best effort: remove only this device's active member before ending Auth.
  await supabase.rpc('clear_active_member');
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) throw error;
}

export async function getFamilySession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}
