import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import {
  getFamilySession,
  signInFamilyAccount,
  signOutFamilyAccount,
  signUpFamilyAccount,
  type FamilySignUpResult,
} from '@/services/auth';
import { listenForAuthAutoRefresh, supabase } from '@/supabase';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<FamilySignUpResult>;
  signIn: (email: string, password: string) => Promise<Session>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const stopAutoRefreshListener = listenForAuthAutoRefresh();

    getFamilySession()
      .then((nextSession) => {
        if (mounted) setSession(nextSession);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      stopAutoRefreshListener();
    };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const result = await signUpFamilyAccount(email, password);
    if (result.session) {
      setSession(result.session);
      setLoading(false);
    }
    return result;
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const nextSession = await signInFamilyAccount(email, password);
    setSession(nextSession);
    setLoading(false);
    return nextSession;
  }, []);

  const signOut = useCallback(async () => {
    await signOutFamilyAccount();
    setSession(null);
    setLoading(false);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ session, user: session?.user ?? null, loading, signUp, signIn, signOut }),
    [loading, session, signIn, signOut, signUp],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe utilizarse dentro de AuthProvider.');
  return context;
}
