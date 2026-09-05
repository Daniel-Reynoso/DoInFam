import { useCallback, useEffect, useMemo, useState } from 'react';
import { Redirect, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { EmptyState, ErrorState, FamilyMemberRow, Screen } from '@/components';
import { useAuth } from '@/hooks';
import { getFamilyRoster, getRememberedMemberId } from '@/services';
import { colors, normalizeAvatarKey, typography } from '@/theme';
import type { FamilyMember } from '@/types';

type SelectorState = {
  familyId?: string;
  familyName: string;
  members: FamilyMember[];
  rememberedMemberId?: string | null;
};

function messageForRosterError(error: unknown) {
  if (error instanceof Error && error.message === 'FAMILY_NOT_CONFIGURED') {
    return 'Esta cuenta todavía no tiene una familia configurada.';
  }
  return 'No pudimos cargar los integrantes. Revisa tu conexión e inténtalo nuevamente.';
}

export default function MemberSelectScreen() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [state, setState] = useState<SelectorState>({ familyName: '', members: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRoster = useCallback(async () => {
    if (!session) return;

    setLoading(true);
    setError(null);
    try {
      const roster = await getFamilyRoster();
      const rememberedMemberId = await getRememberedMemberId(roster.familyId);
      setState({
        familyId: roster.familyId,
        familyName: roster.familyName,
        rememberedMemberId,
        members: roster.members.map((member) => ({
          id: member.id,
          name: member.name,
          initial: member.name.charAt(0).toUpperCase(),
          points: 0,
          goal: 1,
          avatarTone: normalizeAvatarKey(member.avatar_key),
        })),
      });
    } catch (nextError) {
      if (nextError instanceof Error && nextError.message === 'FAMILY_NOT_CONFIGURED') {
        router.replace('/family-start');
        return;
      }
      setError(messageForRosterError(nextError));
    } finally {
      setLoading(false);
    }
  }, [router, session]);

  useEffect(() => {
    if (!authLoading) void loadRoster();
  }, [authLoading, loadRoster]);

  const orderedMembers = useMemo(() => {
    if (!state.rememberedMemberId) return state.members;
    return [...state.members].sort((first, second) => {
      if (first.id === state.rememberedMemberId) return -1;
      if (second.id === state.rememberedMemberId) return 1;
      return 0;
    });
  }, [state.members, state.rememberedMemberId]);

  if (authLoading || loading) {
    return <Screen scroll={false} contentStyle={styles.centerState}><ActivityIndicator color={colors.primary} /></Screen>;
  }

  if (!session) return <Redirect href="/welcome" />;

  if (error) {
    return <Screen scroll={false} contentStyle={styles.centerState}><ErrorState message={error} onRetry={() => void loadRoster()} /></Screen>;
  }

  if (orderedMembers.length === 0) {
    return (
      <Screen scroll={false} contentStyle={styles.centerState}>
        <EmptyState title="Aún no hay integrantes" message="Crea tu perfil para comenzar a sumar puntos." />
        <Text onPress={() => router.push('/create-member-profile')} style={styles.createProfileLink}>+ Crear mi perfil</Text>
      </Screen>
    );
  }

  return (
    <Screen scroll={false} contentStyle={styles.screen}>
      <View style={styles.brand}><Text style={styles.brandSmall}>DOINFAM</Text><Text style={styles.family}>{state.familyName}</Text><Text style={styles.question}>¿Quién está usando la app?</Text></View>
      <View style={styles.list}>
        {orderedMembers.map((member, index) => <FamilyMemberRow key={member.id} member={{ ...member, points: 0, goal: 1 }} entryIndex={index} selectable lastAccess={member.id === state.rememberedMemberId} last={index === orderedMembers.length - 1} variant="selector" onPress={() => router.push({ pathname: '/pin', params: { familyId: state.familyId, memberId: member.id, member: member.name, tone: member.avatarTone } })} />)}
        <Pressable accessibilityRole="button" onPress={() => router.push('/create-member-profile')} style={({ pressed }) => [styles.createProfileRow, pressed && styles.pressed]}>
          <View style={styles.createIcon}><MaterialCommunityIcons name="plus" color={colors.primary} size={26} /></View>
          <View style={styles.content}>
            <Text style={styles.createTitle}>Crear mi perfil</Text>
            <Text style={styles.createNote}>Nombre, avatar, PIN y meta semanal</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" color={colors.textSecondary} size={30} />
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, paddingTop: 0 },
  centerState: { alignItems: 'center', justifyContent: 'center' },
  brand: { alignItems: 'center', paddingTop: 154, marginBottom: 36 },
  brandSmall: { ...typography.label, color: colors.primary, fontSize: 15, lineHeight: 20 },
  family: { ...typography.title, color: colors.text, fontSize: 24, lineHeight: 30, marginTop: 14 },
  question: { ...typography.body, color: colors.textSecondary, fontSize: 15, lineHeight: 21, marginTop: 10 },
  list: { alignSelf: 'stretch', marginHorizontal: 24 },
  content: { flex: 1 },
  createProfileLink: { ...typography.bodyMedium, color: colors.primary, marginTop: 20, textAlign: 'center' },
  createProfileRow: { minHeight: 80, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, gap: 16, backgroundColor: colors.background },
  pressed: { backgroundColor: colors.primarySoft },
  createIcon: { width: 56, height: 56, borderRadius: 28, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  createTitle: { ...typography.bodyMedium, color: colors.primary, fontSize: 16, lineHeight: 21 },
  createNote: { ...typography.metadata, color: colors.textSecondary, marginTop: 2 },
});
