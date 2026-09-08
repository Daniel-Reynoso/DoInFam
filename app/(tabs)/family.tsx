import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, EmptyState, ErrorState, FamilyMemberRow, LoadingSkeleton, Screen, SectionHeader } from '@/components';
import { getFamilyProgress, type FamilyProgress } from '@/services';
import { colors, radius, spacing, typography } from '@/theme';

const weeklyHistoryHref = '/weekly-history' as Href;

export default function FamilyScreen() {
  const router = useRouter();
  const [progress, setProgress] = useState<FamilyProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProgress(await getFamilyProgress());
    } catch (nextError) {
      if (nextError instanceof Error && nextError.message.includes('MEMBER_SESSION')) {
        router.replace('/member-select');
        return;
      }
      setError('No pudimos cargar el progreso familiar. Revisa tu conexión e inténtalo nuevamente.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (loading && !progress) {
    return <Screen><LoadingSkeleton width={100} height={28} /><LoadingSkeleton width={180} height={16} style={styles.loadingGap} /><View style={styles.loadingList}><LoadingSkeleton height={68} /><LoadingSkeleton height={68} /></View></Screen>;
  }

  if (error || !progress) {
    return <Screen scroll={false} contentStyle={styles.centerState}><ErrorState message={error ?? 'No pudimos cargar Familia.'} onRetry={() => void load()} /></Screen>;
  }

  return (
    <Screen>
      <Text style={styles.title}>Familia</Text>
      <Text style={styles.success}>{progress.activeCount > 0 ? `${progress.reachedCount} de ${progress.activeCount} participantes alcanzaron su meta` : 'Todos están en descanso esta semana'}{progress.restingCount > 0 ? ` · ${progress.restingCount} en descanso` : ''}</Text>
      {progress.members.length > 0 ? (
        <View style={styles.list}>{progress.members.map((member, index) => <FamilyMemberRow key={member.id} member={member} rank={index + 1} last={index === progress.members.length - 1} />)}</View>
      ) : (
        <View style={styles.empty}><EmptyState title="Aún no hay integrantes" message="Los integrantes de la familia aparecerán aquí." /></View>
      )}
      <View style={styles.section}>
        <View style={styles.sectionHeading}>
          <SectionHeader title="Consecuencia semanal" />
          <Pressable onPress={() => router.push('/weekly-consequence')} hitSlop={12}>
            <Text style={styles.sectionAction}>{progress.consequence ? 'Editar' : 'Definir'}</Text>
          </Pressable>
        </View>
        <View style={styles.consequence}>
          <Text style={styles.warning}>{progress.consequence ? 'CONSECUENCIA' : 'SIN CONSECUENCIA'}</Text>
          <Text style={progress.consequence ? styles.body : styles.mutedBody}>{progress.consequence ?? 'Aún no han definido una consecuencia para esta semana.'}</Text>
          {!progress.consequence ? <Button label="Definir consecuencia" compact onPress={() => router.push('/weekly-consequence')} style={styles.consequenceButton} /> : null}
        </View>
      </View>
      <Pressable onPress={() => router.push(weeklyHistoryHref)} hitSlop={12}>
        <Text style={styles.historyLink}>Ver semanas anteriores →</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.text },
  success: { ...typography.label, color: colors.success, marginTop: spacing.xxs },
  list: { marginTop: spacing.lg, overflow: 'hidden', borderRadius: radius.md, borderWidth: 1, borderColor: colors.divider },
  section: { marginTop: spacing.xl, gap: spacing.xs },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionAction: { ...typography.label, color: colors.primary },
  consequence: { padding: spacing.md, gap: spacing.xxs, borderWidth: 1, borderColor: colors.warning, borderRadius: radius.md, backgroundColor: colors.surface },
  consequenceButton: { marginTop: spacing.sm, alignSelf: 'flex-start' },
  historyLink: { ...typography.label, color: colors.primary, textAlign: 'center', marginTop: spacing.lg },
  warning: { ...typography.metadata, color: '#A55C00' },
  body: { ...typography.body, color: colors.text },
  mutedBody: { ...typography.body, color: colors.textSecondary },
  empty: { marginTop: spacing.lg, overflow: 'hidden', borderRadius: radius.md, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface },
  loadingGap: { marginTop: spacing.xs },
  loadingList: { marginTop: spacing.lg, gap: 1 },
  centerState: { alignItems: 'center', justifyContent: 'center' },
});
