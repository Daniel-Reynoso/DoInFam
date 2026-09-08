import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Avatar, Button, EmptyState, ErrorState, LoadingSkeleton, PointsFeedback, Screen, SectionHeader, TaskRow, WeeklyClosureModal, WeeklyProgressSummary } from '@/components';
import { useMemberSession } from '@/hooks';
import { completeTask, getHomeSummary, getPendingWeeklyClosure, markWeeklyClosureSeen, type HomeSummary, type WeeklyClosure } from '@/services';
import { colors, normalizeAvatarKey, radius, spacing, typography } from '@/theme';

export default function HomeScreen() {
  const router = useRouter();
  const { activeMember } = useMemberSession();
  const [summary, setSummary] = useState<HomeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [completionFeedback, setCompletionFeedback] = useState<{ points: number; taskName: string; celebrationMessage?: string } | null>(null);
  const [weeklyClosure, setWeeklyClosure] = useState<WeeklyClosure | null>(null);
  const celebrationMessages = [
    '¡Meta cumplida! Tremenda semana 💪',
    '¡Lo lograste! Ya estás del otro lado 🎉',
    'Semana conquistada. Buen trabajo ✨',
    '¡Meta alcanzada! Ahora solo queda mantenerla 🚀',
  ];

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextSummary = await getHomeSummary();
      setSummary(nextSummary);
      try {
        const pendingClosure = await getPendingWeeklyClosure();
        if (pendingClosure) setWeeklyClosure(pendingClosure);
      } catch {
        // Weekly closure should not block the main Home screen.
      }
    } catch (nextError) {
      if (nextError instanceof Error && nextError.message.includes('MEMBER_SESSION')) {
        router.replace('/member-select');
        return;
      }
      setError('No pudimos cargar tu progreso. Revisa tu conexión e inténtalo nuevamente.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const handleComplete = async (task: HomeSummary['tasks'][number]) => {
    if (completingTaskId) return;
    setCompletingTaskId(task.id);
    setActionError(null);
    try {
      const result = await completeTask(task.id);
      if (!result.ok) {
        setActionError(result.code === 'MEMBER_RESTING'
          ? 'Estás en modo descanso. Desactívalo para volver a completar tareas.'
          : result.code === 'TASK_ALREADY_DONE_TODAY'
            ? 'Esta tarea ya se hizo hoy. Mañana vuelve a estar disponible.'
            : 'El cupo de esta tarea acaba de agotarse.');
        await load();
        return;
      }
      setCompletionFeedback({
        points: result.pointsAwarded,
        taskName: task.title,
        celebrationMessage: result.goalReachedNow ? celebrationMessages[Math.floor(Math.random() * celebrationMessages.length)] : undefined,
      });
      await load();
    } catch (nextError) {
      if (nextError instanceof Error && nextError.message.includes('MEMBER_SESSION')) {
        router.replace('/member-select');
        return;
      }
      setActionError('No pudimos completar la tarea. Revisa tu conexión e inténtalo nuevamente.');
    } finally {
      setCompletingTaskId(null);
    }
  };

  const closeWeeklyClosure = async () => {
    const closure = weeklyClosure;
    setWeeklyClosure(null);
    if (!closure) return;
    try {
      await markWeeklyClosureSeen(closure.weekStart);
    } catch {
      // If marking fails, the summary can appear again later. The main flow stays usable.
    }
  };

  const viewWeeklyHistory = async () => {
    await closeWeeklyClosure();
    router.push('/weekly-history');
  };

  if (loading && !summary) {
    return (
      <Screen>
        <View style={styles.header}>
          <View style={styles.loadingTitle}><LoadingSkeleton width={150} height={28} /><LoadingSkeleton width={190} height={14} /></View>
          <LoadingSkeleton width={32} height={32} style={styles.rounded} />
        </View>
        <LoadingSkeleton height={16} />
        <LoadingSkeleton height={8} style={styles.skeletonGap} />
        <View style={styles.section}><LoadingSkeleton width={140} height={14} /><LoadingSkeleton height={190} /></View>
      </Screen>
    );
  }

  if (error || !summary) {
    return <Screen scroll={false} contentStyle={styles.centerState}><ErrorState message={error ?? 'No pudimos cargar Inicio.'} onRetry={() => void load()} /></Screen>;
  }

  const availableNow = summary.tasks.filter((task) => task.status !== 'exhausted' && task.status !== 'done-today' && task.status !== 'inactive');

  return (
    <Screen>
      <View style={styles.header}>
        <View><Text style={styles.title}>Hola, {activeMember?.name ?? 'familia'}</Text><Text style={styles.motivation}>{summary.points > 0 ? `${summary.points} pts ganados esta semana` : 'Tu semana empieza aquí'}</Text></View>
        <Avatar initial={(activeMember?.name.charAt(0) ?? 'F').toUpperCase()} size="sm" tone={normalizeAvatarKey(activeMember?.avatarKey)} />
      </View>
      {!summary.isResting ? <WeeklyProgressSummary points={summary.points} goal={summary.goal} daysLeft={summary.daysLeft} /> : null}

      {summary.isResting ? (
        <View style={styles.restCard}>
          <View style={styles.restIcon}><Text style={styles.restEmoji}>🌤️</Text></View>
          <Text style={styles.restTitle}>Estás en descanso</Text>
          <Text style={styles.restBody}>Tus tareas están pausadas. Conservas tus {summary.points} pts y no se evaluará tu meta si sigues en descanso al cerrar la semana.</Text>
          <Button compact variant="secondary" label="Administrar descanso" onPress={() => router.push('/rest-mode' as Href)} />
        </View>
      ) : (
        <View style={styles.section}>
          <SectionHeader title="Puedes hacer ahora" />
          {actionError ? <Text accessibilityLiveRegion="polite" style={styles.actionError}>{actionError}</Text> : null}
          {availableNow.length > 0 ? <View style={styles.list}>{availableNow.map((task, index) => <TaskRow key={task.id} task={task} entryIndex={index} completing={completingTaskId === task.id} onComplete={() => void handleComplete(task)} />)}</View> : <View style={styles.empty}><EmptyState title="No hay tareas disponibles ahora" message={summary.tasks.length === 0 ? 'Cuando creen la primera tarea, aparecerá aquí.' : 'Buen avance. Vuelve mañana o revisa Tareas para ver el estado completo.'} /></View>}
        </View>
      )}
      <PointsFeedback visible={completionFeedback !== null} points={completionFeedback?.points ?? 0} taskName={completionFeedback?.taskName ?? ''} celebrationMessage={completionFeedback?.celebrationMessage} onClose={() => setCompletionFeedback(null)} />
      <WeeklyClosureModal visible={weeklyClosure !== null} closure={weeklyClosure} onClose={() => void closeWeeklyClosure()} onViewHistory={() => void viewWeeklyHistory()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xl },
  title: { ...typography.title, color: colors.text },
  motivation: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xxs },
  section: { marginTop: spacing.xl, gap: spacing.xs },
  list: { overflow: 'hidden', borderWidth: 1, borderColor: colors.divider, borderRadius: radius.md },
  empty: { overflow: 'hidden', borderWidth: 1, borderColor: colors.divider, borderRadius: radius.md, backgroundColor: colors.surface },
  centerState: { alignItems: 'center', justifyContent: 'center' },
  loadingTitle: { gap: spacing.xs },
  rounded: { borderRadius: 16 },
  skeletonGap: { marginTop: spacing.xs },
  actionError: { ...typography.caption, color: colors.danger, textAlign: 'center', marginBottom: spacing.xs },
  restCard: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.xl, padding: spacing.xl, borderWidth: 1, borderColor: colors.primary, borderRadius: radius.md, backgroundColor: colors.surface },
  restIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  restEmoji: { fontSize: 32 },
  restTitle: { ...typography.title, color: colors.text, textAlign: 'center' },
  restBody: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xs },
});
