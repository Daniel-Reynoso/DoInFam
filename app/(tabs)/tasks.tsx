import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, EmptyState, ErrorState, LoadingSkeleton, PointsFeedback, Screen, SegmentedControl, TaskRow } from '@/components';
import { completeTask, getRestMode, listTasks, playSound, type TaskListItem } from '@/services';
import { colors, radius, spacing, typography } from '@/theme';

type Filter = 'available' | 'all' | 'inactive';

export default function TasksScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('available');
  const [tasks, setTasks] = useState<TaskListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [completionFeedback, setCompletionFeedback] = useState<{ points: number; taskName: string; celebrationMessage?: string } | null>(null);
  const [isResting, setIsResting] = useState(false);
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
      const [nextTasks, restMode] = await Promise.all([listTasks(), getRestMode()]);
      setTasks(nextTasks);
      setIsResting(restMode.active);
    }
    catch { setError('No pudimos cargar las tareas. Revisa tu conexión e inténtalo nuevamente.'); }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const visibleTasks = useMemo(() => tasks.filter((task) => {
    if (filter === 'inactive') return !task.isActive;
    if (filter === 'available') return task.isActive && task.status !== 'exhausted' && task.status !== 'done-today';
    return true;
  }), [filter, tasks]);

  const openTask = (task?: TaskListItem) => router.push({ pathname: '/task-form', params: task ? { taskId: task.id } : undefined });

  const handleComplete = async (task: TaskListItem) => {
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

  return (
    <Screen>
      <View style={styles.header}><Text style={styles.title}>Tareas</Text>{!isResting ? <Button compact label="+ Nueva" onPress={() => openTask()} /> : null}</View>
      {!isResting ? <SegmentedControl value={filter} onChange={(value) => setFilter(value as Filter)} options={[{ label: 'Disponibles', value: 'available' }, { label: 'Todas', value: 'all' }, { label: 'Inactivas', value: 'inactive' }]} /> : null}
      {!isResting ? (
        <Pressable accessibilityRole="button" onPress={() => { void playSound('buttonPop'); router.push('/past-task' as Href); }} style={({ pressed }) => [styles.pastTaskAction, pressed && styles.pastTaskPressed]}>
          <View style={styles.pastTaskIcon}><MaterialCommunityIcons name="history" size={22} color={colors.primary} /></View>
          <View style={styles.pastTaskCopy}><Text style={styles.pastTaskTitle}>Registrar tarea pasada</Text><Text style={styles.pastTaskSubtitle}>¿Olvidaste marcar algo de esta semana?</Text></View>
          <MaterialCommunityIcons name="chevron-right" size={24} color={colors.textSecondary} />
        </Pressable>
      ) : null}
      {actionError ? <Text accessibilityLiveRegion="polite" style={styles.actionError}>{actionError}</Text> : null}
      {loading && tasks.length === 0 ? (
        <View style={styles.loading}><LoadingSkeleton height={64} /><LoadingSkeleton height={64} /><LoadingSkeleton height={64} /></View>
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : isResting ? (
        <View style={styles.empty}><EmptyState title="Tus tareas están en pausa 🌤️" message="Estás en modo descanso. Puedes volver a participar cuando quieras desde Ajustes." actionLabel="Administrar descanso" onAction={() => router.push('/rest-mode' as Href)} /></View>
      ) : visibleTasks.length > 0 ? (
        <View style={styles.list}>{visibleTasks.map((task, index) => <TaskRow key={task.id} task={task} entryIndex={index} showAction={task.isActive} completing={completingTaskId === task.id} onComplete={() => void handleComplete(task)} onPress={() => openTask(task)} />)}</View>
      ) : (
        <View style={styles.empty}><EmptyState title={tasks.length === 0 ? 'Aún no hay tareas' : filter === 'inactive' ? 'No hay tareas inactivas' : 'No hay tareas disponibles'} message={tasks.length === 0 ? 'Crea la primera tarea para empezar a sumar puntos.' : 'Prueba otro filtro para ver más tareas.'} actionLabel={tasks.length === 0 ? 'Crear primera tarea' : undefined} onAction={tasks.length === 0 ? () => openTask() : undefined} /></View>
      )}
      <PointsFeedback visible={completionFeedback !== null} points={completionFeedback?.points ?? 0} taskName={completionFeedback?.taskName ?? ''} celebrationMessage={completionFeedback?.celebrationMessage} onClose={() => setCompletionFeedback(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  title: { ...typography.title, color: colors.text },
  list: { marginTop: spacing.md, overflow: 'hidden', borderRadius: radius.md, borderWidth: 1, borderColor: colors.divider },
  loading: { marginTop: spacing.md, gap: 1 },
  empty: { marginTop: spacing.md, overflow: 'hidden', borderRadius: radius.md, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface },
  actionError: { ...typography.caption, color: colors.danger, textAlign: 'center', marginTop: spacing.sm },
  pastTaskAction: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderColor: colors.divider, borderRadius: radius.md, backgroundColor: colors.surface },
  pastTaskPressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  pastTaskIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  pastTaskCopy: { flex: 1 },
  pastTaskTitle: { ...typography.bodyMedium, color: colors.text },
  pastTaskSubtitle: { ...typography.caption, color: colors.textSecondary },
});
