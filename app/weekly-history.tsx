import { useEffect, useMemo, useState } from 'react';
import { Redirect, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Avatar, EmptyState, ErrorState, LoadingSkeleton, Screen, StatusLabel } from '@/components';
import { useAuth, useMemberSession } from '@/hooks';
import { getWeeklyHistory, type WeeklyHistoryWeek } from '@/services';
import { colors, radius, spacing, typography } from '@/theme';

export default function WeeklyHistoryScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { activeMember } = useMemberSession();
  const [weeks, setWeeks] = useState<WeeklyHistoryWeek[]>([]);
  const [selectedWeekStart, setSelectedWeekStart] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const history = await getWeeklyHistory();
      setWeeks(history);
      setSelectedWeekStart((current) => current && history.some((week) => week.weekStart === current) ? current : history[0]?.weekStart ?? null);
    } catch (nextError) {
      if (nextError instanceof Error && nextError.message.includes('MEMBER_SESSION')) {
        router.replace('/member-select');
        return;
      }
      setError('No pudimos cargar las semanas anteriores. Revisa tu conexión e inténtalo nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const selectedWeek = useMemo(() => weeks.find((week) => week.weekStart === selectedWeekStart) ?? weeks[0] ?? null, [selectedWeekStart, weeks]);

  if (!session) return <Redirect href="/welcome" />;
  if (!activeMember) return <Redirect href="/member-select" />;

  if (loading) {
    return (
      <Screen>
        <View style={styles.header}><LoadingSkeleton width={34} height={34} style={styles.rounded} /><LoadingSkeleton width={250} height={34} /></View>
        <View style={styles.chipSkeletons}><LoadingSkeleton width={112} height={48} style={styles.pill} /><LoadingSkeleton width={88} height={48} style={styles.pill} /></View>
        <LoadingSkeleton width={170} height={18} style={styles.sectionGap} />
        <LoadingSkeleton height={260} style={styles.cardSkeleton} />
      </Screen>
    );
  }

  if (error) {
    return <Screen scroll={false} contentStyle={styles.center}><ErrorState message={error} onRetry={() => void load()} /></Screen>;
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Volver" onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/family')} hitSlop={12} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Semanas anteriores</Text>
      </View>

      {weeks.length === 0 || !selectedWeek ? (
        <View style={styles.emptyWrap}>
          <EmptyState title="Aún no hay semanas cerradas" message="Cuando termine tu primera semana, aquí verás el resumen familiar ✨" />
        </View>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weekTabs}>
            {weeks.map((week) => {
              const selected = week.weekStart === selectedWeek.weekStart;
              return (
                <Pressable key={week.weekStart} onPress={() => setSelectedWeekStart(week.weekStart)} style={[styles.weekChip, selected && styles.weekChipActive]}>
                  <Text style={[styles.weekChipText, selected && styles.weekChipTextActive]}>{week.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={styles.range}>{selectedWeek.rangeLabel}</Text>

          <SectionTitle>Puntos de la semana</SectionTitle>
          <PointsCard week={selectedWeek} />

          <SectionTitle>Metas semanales</SectionTitle>
          <GoalsCard week={selectedWeek} />

          <SectionTitle>Resumen de la semana</SectionTitle>
          <View style={styles.activityList}>
            {selectedWeek.activities.length > 0 ? selectedWeek.activities.map((activity) => (
              <View key={activity.id} style={styles.activityCard}>
                <View style={[styles.activityAccent, { backgroundColor: activity.color }]} />
                <View style={styles.activityContent}>
                  <Text style={styles.activityText}>{activity.text}</Text>
                  <Text style={styles.activityDate}>{activity.dateLabel}</Text>
                </View>
              </View>
            )) : <View style={styles.emptyWrap}><EmptyState title="Sin actividad registrada" message="Esta semana cerró sin tareas completadas." /></View>}
          </View>
        </>
      )}
    </Screen>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function PointsCard({ week }: { week: WeeklyHistoryWeek }) {
  const maxPoints = Math.max(...week.members.map((member) => member.points), 1);
  return (
    <View style={styles.pointsCard}>
      {week.members.map((member) => {
        const barHeight = 86 + (member.points / maxPoints) * 92;
        return (
          <View key={member.id} style={styles.barItem}>
            <Text style={styles.barPoints}>{member.points}</Text>
            <Text style={styles.barPts}>pts</Text>
            <View style={styles.barTrack}>
              <View style={[styles.bar, { height: barHeight, backgroundColor: member.color }]} />
            </View>
            <Avatar initial={member.initial} size="sm" tone={member.avatarTone} />
            <Text numberOfLines={1} style={styles.barName}>{member.name}</Text>
          </View>
        );
      })}
    </View>
  );
}

function GoalsCard({ week }: { week: WeeklyHistoryWeek }) {
  return (
    <View style={styles.goalsCard}>
      <View style={styles.goalsHeading}>
        <Text style={styles.goalsTitle}>METAS SEMANALES</Text>
        <StatusLabel label={week.goalLabel} tone="success" />
      </View>
      <View style={styles.divider} />
      {week.members.map((member) => (
        <View key={member.id} style={styles.goalRow}>
          <View style={[styles.goalDot, { backgroundColor: member.color }]} />
          <Text style={styles.goalName}>{member.name}</Text>
          <Text style={styles.goalPoints}>{member.isResting ? 'En descanso' : `${member.points}/${member.goal}`}</Text>
          <MaterialCommunityIcons name={member.isResting ? 'weather-sunset' : member.goalReached ? 'check-circle-outline' : 'close-circle-outline'} size={25} color={member.isResting ? colors.primary : member.goalReached ? colors.success : colors.danger} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  backButton: { width: 34, height: 34, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.display, color: colors.text, flex: 1 },
  weekTabs: { gap: spacing.sm, paddingVertical: spacing.xl },
  weekChip: { minWidth: 86, minHeight: 44, paddingHorizontal: spacing.lg, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.transparent },
  weekChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  weekChipText: { ...typography.subtitle, color: colors.textSecondary },
  weekChipTextActive: { color: colors.text },
  range: { ...typography.caption, color: colors.textSecondary, marginTop: -spacing.md, marginBottom: spacing.md },
  sectionTitle: { ...typography.subtitle, color: colors.textSecondary, textTransform: 'uppercase', marginTop: spacing.lg, marginBottom: spacing.sm },
  pointsCard: { minHeight: 270, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.xl, paddingBottom: spacing.lg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
  barItem: { flex: 1, minWidth: 58, alignItems: 'center' },
  barPoints: { ...typography.subtitle, color: colors.text },
  barPts: { ...typography.bodyMedium, color: colors.textSecondary, marginTop: -2 },
  barTrack: { height: 184, justifyContent: 'flex-end', marginTop: spacing.sm, marginBottom: spacing.sm },
  bar: { width: 34, borderTopLeftRadius: radius.sm, borderTopRightRadius: radius.sm },
  barName: { ...typography.bodyMedium, color: colors.text, marginTop: spacing.xs, maxWidth: 82 },
  goalsCard: { padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
  goalsHeading: { minHeight: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  goalsTitle: { ...typography.subtitle, color: colors.textSecondary, textTransform: 'uppercase' },
  divider: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.md },
  goalRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  goalDot: { width: 8, height: 8, borderRadius: 4 },
  goalName: { ...typography.subtitle, color: colors.text, flex: 1 },
  goalPoints: { ...typography.caption, color: colors.textSecondary },
  activityList: { gap: spacing.sm, paddingBottom: spacing.xl },
  activityCard: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
  activityAccent: { width: 5, alignSelf: 'stretch', borderRadius: radius.pill },
  activityContent: { flex: 1, gap: spacing.xs },
  activityText: { ...typography.subtitle, color: colors.text },
  activityDate: { ...typography.bodyMedium, color: colors.textSecondary },
  emptyWrap: { marginTop: spacing.xl, overflow: 'hidden', borderWidth: 1, borderColor: colors.divider, borderRadius: radius.md, backgroundColor: colors.surface },
  center: { alignItems: 'center', justifyContent: 'center' },
  rounded: { borderRadius: radius.pill },
  pill: { borderRadius: radius.pill },
  chipSkeletons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl },
  sectionGap: { marginTop: spacing.lg },
  cardSkeleton: { marginTop: spacing.sm, borderRadius: radius.md },
});
