import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import {
  clearActiveMember,
  getActiveMember,
  selectMemberWithPin,
  type ActiveMember,
  type MemberPinResult,
} from '@/services/members';
import { useAuth } from './AuthProvider';

type MemberSessionContextValue = {
  activeMember: ActiveMember | null;
  loading: boolean;
  refresh: () => Promise<ActiveMember | null>;
  selectMember: (memberId: string, pin: string) => Promise<MemberPinResult>;
  clearMember: () => Promise<void>;
};

const MemberSessionContext = createContext<MemberSessionContextValue | null>(null);

export function MemberSessionProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const [activeMember, setActiveMember] = useState<ActiveMember | null>(null);
  const [loading, setLoading] = useState(Boolean(session));

  const refresh = useCallback(async () => {
    if (!session) {
      setActiveMember(null);
      return null;
    }
    const member = await getActiveMember();
    setActiveMember(member);
    return member;
  }, [session]);

  useEffect(() => {
    let mounted = true;
    if (!session) {
      setActiveMember(null);
      setLoading(false);
      return () => {
        mounted = false;
      };
    }

    setLoading(true);
    getActiveMember()
      .then((member) => {
        if (mounted) setActiveMember(member);
      })
      .catch(() => {
        if (mounted) setActiveMember(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [session]);

  const selectMember = useCallback(
    async (memberId: string, pin: string) => {
      const result = await selectMemberWithPin(memberId, pin);
      if (result.ok) await refresh();
      return result;
    },
    [refresh],
  );

  const clearMember = useCallback(async () => {
    if (session) await clearActiveMember();
    setActiveMember(null);
  }, [session]);

  const value = useMemo<MemberSessionContextValue>(
    () => ({ activeMember, loading, refresh, selectMember, clearMember }),
    [activeMember, clearMember, loading, refresh, selectMember],
  );

  return (
    <MemberSessionContext.Provider value={value}>
      {children}
    </MemberSessionContext.Provider>
  );
}

export function useMemberSession() {
  const context = useContext(MemberSessionContext);
  if (!context) {
    throw new Error('useMemberSession debe utilizarse dentro de MemberSessionProvider.');
  }
  return context;
}
