import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, EmptyState, ErrorState, LoadingSkeleton, PointsFeedback, Screen, StatusLabel } from '@/components';
import { useAuth, useMemberSession, usePressScale, useReducedMotion } from '@/hooks';
import { completePastTask, getRestMode, listPastTaskOptions, playSound, type PastTaskOption } from '@/services';
import { colors, radius, spacing, typography } from '@/theme';

type PastDate = { value: string; label: string; detail: string };

const celebrationMessages = [
  '¡Meta cumplida! Tremenda semana 💪',
  '¡Lo lograste! Ya estás del otro lado 🎉',
  'Semana conquistada. Buen trabajo ✨',
  '¡Meta alcanzada! Ahora solo queda mantenerla 🚀',
];

const dayFormatter = new Intl.DateTimeFormat('es-PE', { timeZone: 'UTC', weekday: 'long' });
const dateFormatter = new Intl.DateTimeFormat('es-PE', { timeZone: 'UTC', day: 'numeric', month: 'short' });

function limaTodayParts() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return { year: read('year'), month: read('month'), day: read('day') };
}

function formatDateValue(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function getPastDates(): PastDate[] {
  const today = limaTodayParts();
  const current = new Date(Date.UTC(today.year, today.month - 1, today.day, 12));
  const daysSinceMonday = (current.getUTCDay() + 6) % 7;
  return Array.from({ length: daysSinceMonday }, (_, index) => {
    const offset = index + 1;
    const date = new Date(current);
    date.setUTCDate(current.getUTCDate() - offset);
    const weekday = dayFormatter.format(date);
    return {
      value: formatDateValue(date),
      label: offset === 1 ? 'Ayer' : `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}`,
      detail: dateFormatter.format(date).replace('.', ''),
    };
  });
}

function availabilityText(task: PastTaskOption) {
  if (task.isAvailable) return `${task.remainingQuota} ${task.remainingQuota === 1 ? 'cupo disponible' : 'cupos disponibles'}`;
  return task.unavailableReason === 'TASK_ALREADY_DONE_ON_DATE' ? 'Ya se registró ese día' : 'Cupo agotado';
}

export default function PastTaskScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { activeMember } = useMemberSession();
  const dates = useMemo(getPastDates, []);
  const [selectedDate, setSelectedDate] = useState(dates[0]?.value ?? '');
  const [tasks, setTasks] = useState<PastTaskOption[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [loading, setLoading] = useState(dates.length > 0);
  const [saving, setSaving] = useState(false);
  const [isResting, setIsResting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ points: number; taskName: string; celebrationMessage?: string } | null>(null);

  const selectedDateOption = dates.find((date) => date.value === selectedDate);
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null;

  const load = async (date: string) => {
    if (!date) return;
    setLoading(true);
    setError(null);
    setActionError(null);
    try {
      const [nextTasks, restMode] = await Promise.all([listPastTaskOptions(date), getRestMode()]);
      setTasks(nextTasks);
      setIsResting(restMode.active);
      setSelectedTaskId((current) => nextTasks.some((task) => task.id === current && task.isAvailable) ? current : null);
    } catch (nextError) {
      if (nextError instanceof Error && nextError.message.includes('MEMBER_SESSION')) {
        router.replace('/member-select');
        return;
      }
      setError('No pudimos revisar las tareas de ese día. Revisa tu conexión e inténtalo nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (selectedDate) void load(selectedDate); }, [selectedDate]);

  if (!session) return <Redirect href="/welcome" />;
  if (!activeMember) return <Redirect href="/member-select" />;

  const register = async () => {
    if (!selectedTask || !selectedDate || saving) return;
    setSaving(true);
    setActionError(null);
    try {
      const result = await completePastTask(selectedTask.id, selectedDate);
      if (!result.ok) {
        setActionError(result.code === 'MEMBER_RESTING'
          ? 'Estás en modo descanso. Desactívalo para volver a registrar tareas.'
          : result.code === 'TASK_ALREADY_DONE_ON_DATE'
            ? 'Esta tarea ya fue registrada para ese día.'
            : 'El cupo de esta tarea acaba de agotarse.');
        await load(selectedDate);
        return;
      }
      setFeedback({
        points: result.pointsAwarded,
        taskName: `${selectedTask.title} · ${selectedDateOption?.label ?? ''}`,
        celebrationMessage: result.goalReachedNow ? celebrationMessages[Math.floor(Math.random() * celebrationMessages.length)] : undefined,
      });
      setSelectedTaskId(null);
      await load(selectedDate);
    } catch (nextError) {
      if (nextError instanceof Error && nextError.message.includes('MEMBER_SESSION')) {
        router.replace('/member-select');
        return;
      }
      setActionError('No pudimos registrar la tarea. Revisa tu conexión e inténtalo nuevamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen contentStyle={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Volver" hitSlop={12} onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/tasks')} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <MaterialCommunityIcons name="arrow-left" size={30} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Tarea pasada</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.intro}>
        <View style={styles.introIcon}><MaterialCommunityIcons name="history" size={34} color={colors.primary} /></View>
        <View style={styles.introCopy}>
          <Text style={styles.title}>¿Se te pasó registrarla?</Text>
          <Text style={styles.subtitle}>Añade una tarea de un día anterior de esta semana. Sus puntos y cupos se calcularán en esa fecha.</Text>
        </View>
      </View>

      {dates.length === 0 ? (
        <View style={styles.empty}><EmptyState title="La semana recién empieza" message="Desde mañana podrás registrar aquí una tarea que olvidaste marcar hoy." /></View>
      ) : isResting ? (
        <View style={styles.empty}><EmptyState title="Tus tareas están en pausa 🌤️" message="Desactiva el modo descanso antes de registrar una tarea pasada." actionLabel="Volver a Ajustes" onAction={() => router.replace('/settings')} /></View>
      ) : (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>1. ¿Qué día la hiciste?</Text>
            <View style={styles.dateGrid}>{dates.map((date) => <DateChoice key={date.value} date={date} selected={date.value === selectedDate} onPress={() => { setSelectedTaskId(null); setSelectedDate(date.value); }} />)}</View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>2. Elige la tarea</Text>
            {loading ? (
              <View style={styles.loading}><LoadingSkeleton height={72} /><LoadingSkeleton height={72} /><LoadingSkeleton height={72} /></View>
            ) : error ? (
              <View style={styles.empty}><ErrorState message={error} onRetry={() => void load(selectedDate)} /></View>
            ) : tasks.length === 0 ? (
              <View style={styles.empty}><EmptyState title="No hay tareas activas" message="Cuando haya una tarea disponible podrás registrarla aquí." /></View>
            ) : (
              <View style={styles.taskList}>{tasks.map((task) => <PastTaskChoice key={task.id} task={task} selected={task.id === selectedTaskId} onPress={() => setSelectedTaskId(task.id)} />)}</View>
            )}
          </View>

          {selectedTask ? (
            <View style={styles.confirmation}>
              <View style={styles.confirmationText}>
                <Text style={styles.confirmationTitle}>{selectedTask.title}</Text>
                <Text style={styles.confirmationMeta}>{selectedDateOption?.label}, {selectedDateOption?.detail} · +{selectedTask.points} pts</Text>
              </View>
              <MaterialCommunityIcons name="check-circle-outline" size={28} color={colors.primary} />
            </View>
          ) : null}

          {actionError ? <Text accessibilityLiveRegion="polite" style={styles.error}>{actionError}</Text> : null}
          <Button label="Registrar tarea" disabled={!selectedTask || loading} loading={saving} onPress={() => void register()} />
          <Text style={styles.helper}>Luego podrás registrar otra si olvidaste más de una.</Text>
        </>
      )}

      <PointsFeedback visible={feedback !== null} points={feedback?.points ?? 0} taskName={feedback?.taskName ?? ''} title="¡Tarea registrada!" celebrationMessage={feedback?.celebrationMessage} onClose={() => setFeedback(null)} />
    </Screen>
  );
}

function DateChoice({ date, selected, onPress }: { date: PastDate; selected: boolean; onPress: () => void }) {
  const reducedMotion = useReducedMotion();
  const { scale, pressIn, pressOut } = usePressScale(!reducedMotion, 0.97);
  return (
    <Animated.View style={[styles.dateChoiceWrap, { transform: [{ scale }] }]}>
      <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={() => { void playSound('buttonPop'); onPress(); }} onPressIn={pressIn} onPressOut={pressOut} style={({ pressed }) => [styles.dateChoice, selected && styles.dateChoiceSelected, pressed && styles.pressed]}>
        <Text style={[styles.dateLabel, selected && styles.dateLabelSelected]}>{date.label}</Text>
        <Text style={[styles.dateDetail, selected && styles.dateDetailSelected]}>{date.detail}</Text>
      </Pressable>
    </Animated.View>
  );
}

function PastTaskChoice({ task, selected, onPress }: { task: PastTaskOption; selected: boolean; onPress: () => void }) {
  const reducedMotion = useReducedMotion();
  const { scale, pressIn, pressOut } = usePressScale(task.isAvailable && !reducedMotion, 0.985);
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected, disabled: !task.isAvailable }} disabled={!task.isAvailable} onPress={() => { void playSound('buttonPop'); onPress(); }} onPressIn={pressIn} onPressOut={pressOut} style={({ pressed }) => [styles.taskChoice, selected && styles.taskChoiceSelected, !task.isAvailable && styles.taskChoiceDisabled, pressed && task.isAvailable && styles.pressed]}>
        <View style={[styles.radio, selected && styles.radioSelected]}>{selected ? <View style={styles.radioDot} /> : null}</View>
        <View style={styles.taskCopy}>
          <Text style={styles.taskTitle}>{task.title}</Text>
          <View style={styles.taskMeta}>
            <Text style={styles.points}>+{task.points} pts</Text>
            <Text style={styles.availability}>{availabilityText(task)}</Text>
          </View>
        </View>
        {!task.isAvailable ? <StatusLabel label={task.unavailableReason === 'TASK_ALREADY_DONE_ON_DATE' ? 'Hecha' : 'Agotada'} tone="neutral" /> : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { paddingTop: spacing.xl, gap: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.title, color: colors.text },
  headerSpacer: { width: 44 },
  intro: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  introIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  introCopy: { flex: 1 },
  title: { ...typography.subtitle, color: colors.text },
  subtitle: { ...typography.body, color: colors.textSecondary, fontSize: 15, lineHeight: 21, marginTop: spacing.xxs },
  section: { gap: spacing.sm },
  sectionLabel: { ...typography.label, color: colors.textSecondary, textTransform: 'uppercase' },
  dateGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  dateChoiceWrap: { minWidth: 92, flexGrow: 1 },
  dateChoice: { minHeight: 62, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
  dateChoiceSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  dateLabel: { ...typography.label, color: colors.text },
  dateLabelSelected: { color: colors.surface },
  dateDetail: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xxs },
  dateDetailSelected: { color: colors.surface },
  taskList: { overflow: 'hidden', borderWidth: 1, borderColor: colors.divider, borderRadius: radius.lg, backgroundColor: colors.surface },
  taskChoice: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider, backgroundColor: colors.surface },
  taskChoiceSelected: { backgroundColor: colors.primarySoft },
  taskChoiceDisabled: { opacity: 0.58 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  taskCopy: { flex: 1 },
  taskTitle: { ...typography.bodyMedium, color: colors.text },
  taskMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xxs },
  points: { ...typography.metadata, color: colors.primary },
  availability: { ...typography.metadata, color: colors.textSecondary },
  confirmation: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderWidth: 1, borderColor: colors.primary, borderRadius: radius.md, backgroundColor: colors.surface },
  confirmationText: { flex: 1 },
  confirmationTitle: { ...typography.label, color: colors.text },
  confirmationMeta: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xxs },
  helper: { ...typography.caption, color: colors.textSecondary, textAlign: 'center', marginTop: -spacing.md },
  error: { ...typography.caption, color: colors.danger, textAlign: 'center' },
  loading: { gap: 1 },
  empty: { overflow: 'hidden', borderWidth: 1, borderColor: colors.divider, borderRadius: radius.lg, backgroundColor: colors.surface },
  pressed: { opacity: 0.82 },
});
