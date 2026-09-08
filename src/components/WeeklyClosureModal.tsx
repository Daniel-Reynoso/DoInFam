import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { playSound } from '@/services/sound';
import type { WeeklyClosure } from '@/services/weeklyClosure';
import { colors, radius, spacing, typography } from '@/theme';
import { Button } from './Button';

type Props = {
  closure: WeeklyClosure | null;
  visible: boolean;
  onClose: () => void;
  onViewHistory: () => void;
};

const successMessages = [
  'Cerraste la semana con fuerza. Bien jugado 💪',
  'Meta lograda, semana conquistada 🎉',
  'Ese progreso se nota. A seguir así ✨',
];

const missMessages = [
  'No pasa nada: semana nueva, intento nuevo 🌱',
  'Esta vez faltó poquito/mucho, pero ya sabes por dónde empujar 💛',
  'Se cierra la semana y empieza otra oportunidad 🧡',
];

const formatter = new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', day: 'numeric', month: 'short' });

function rangeLabel(weekStart: string) {
  const start = new Date(`${weekStart}T12:00:00Z`);
  const end = new Date(start.getTime() + 6 * 86_400_000);
  return `${formatter.format(start)} - ${formatter.format(end)}`;
}

function pickMessage(closure: WeeklyClosure) {
  const list = closure.goalReached ? successMessages : missMessages;
  let total = 0;
  for (let index = 0; index < closure.weekStart.length + closure.memberName.length; index += 1) {
    total += `${closure.weekStart}${closure.memberName}`.charCodeAt(index);
  }
  return list[total % list.length];
}

export function WeeklyClosureModal({ closure, visible, onClose, onViewHistory }: Props) {
  const { height } = useWindowDimensions();
  const message = useMemo(() => closure ? pickMessage(closure) : '', [closure]);
  const topTasks = useMemo(() => {
    const grouped = new Map<string, { id: string; title: string; points: number }>();
    closure?.topTasks.forEach((task) => {
      const key = task.title.trim().toLocaleLowerCase('es');
      const current = grouped.get(key);
      if (current) current.points += task.points;
      else grouped.set(key, { id: task.id, title: task.title, points: task.points });
    });
    return [...grouped.values()].sort((left, right) => right.points - left.points).slice(0, 2);
  }, [closure]);

  useEffect(() => {
    if (!visible || !closure) return;
    void playSound(closure.goalReached ? 'goalReached' : 'weekFailed');
  }, [closure, visible]);

  if (!closure) return null;

  const progress = closure.targetPoints > 0 ? Math.min(100, Math.round((closure.earnedPoints / closure.targetPoints) * 100)) : 0;

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.card, { maxHeight: Math.max(260, height - spacing.xl) }]}>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} bounces={false}>
            <View style={[styles.icon, closure.goalReached ? styles.successIcon : styles.warningIcon]}>
              <MaterialCommunityIcons name={closure.goalReached ? 'party-popper' : 'weather-sunset'} size={26} color={colors.surface} />
            </View>

            <Text style={styles.kicker}>Semana cerrada</Text>
            <Text style={styles.title}>{closure.goalReached ? '¡Meta cumplida!' : 'No se alcanzó la meta'}</Text>
            <Text style={styles.subtitle}>{rangeLabel(closure.weekStart)}</Text>

            <View style={styles.scoreCard}>
              <Text style={styles.score}><Text style={styles.scoreStrong}>{closure.earnedPoints}</Text> / {closure.targetPoints} pts</Text>
              <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View>
              <Text style={styles.scoreHint}>
                {closure.goalReached
                  ? `${closure.memberName} completó ${closure.taskCount} tarea${closure.taskCount === 1 ? '' : 's'} esta semana.`
                  : `Faltaron ${closure.pointsMissing} pts para llegar.`}
              </Text>
            </View>

            <Text style={styles.message}>{message}</Text>

            {!closure.goalReached && closure.consequence ? (
              <View style={styles.consequence}>
                <Text style={styles.consequenceLabel}>Consecuencia acordada</Text>
                <Text style={styles.consequenceText}>{closure.consequence}</Text>
              </View>
            ) : null}

            {topTasks.length > 0 ? (
              <View style={styles.tasks}>
                {topTasks.map((task) => (
                  <View key={task.id} style={styles.taskRow}>
                    <Text numberOfLines={1} style={styles.taskTitle}>{task.title}</Text>
                    <Text style={styles.taskPoints}>+{task.points} pts</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.actions}>
            <Button label="Ver resumen" compact onPress={onViewHistory} />
            <Button label="Cerrar" compact variant="secondary" onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.overlay, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  card: { width: '100%', maxWidth: 360, overflow: 'hidden', borderRadius: radius.xl, backgroundColor: colors.surface },
  scroll: { width: '100%', flexShrink: 1 },
  content: { alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.xs },
  icon: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  successIcon: { backgroundColor: colors.primary },
  warningIcon: { backgroundColor: colors.warning },
  kicker: { ...typography.label, color: colors.primary, textTransform: 'uppercase', marginTop: spacing.xs },
  title: { ...typography.title, color: colors.text, textAlign: 'center' },
  subtitle: { ...typography.caption, color: colors.textSecondary },
  scoreCard: { width: '100%', padding: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.background, gap: spacing.xs, marginTop: spacing.xs },
  score: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },
  scoreStrong: { ...typography.title, fontSize: 30, lineHeight: 34, color: colors.text },
  progressTrack: { height: 8, overflow: 'hidden', borderRadius: 4, backgroundColor: colors.divider },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: colors.primary },
  scoreHint: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },
  message: { ...typography.bodyMedium, color: colors.text, textAlign: 'center', marginVertical: spacing.xs },
  consequence: { width: '100%', borderWidth: 1, borderColor: colors.warning, borderRadius: radius.md, padding: spacing.sm, backgroundColor: colors.warningSoft },
  consequenceLabel: { ...typography.label, color: colors.warning, textTransform: 'uppercase' },
  consequenceText: { ...typography.body, color: colors.text, marginTop: spacing.xxs },
  tasks: { width: '100%', overflow: 'hidden', borderWidth: 1, borderColor: colors.divider, borderRadius: radius.md },
  taskRow: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  taskTitle: { ...typography.body, color: colors.text, flex: 1 },
  taskPoints: { ...typography.label, color: colors.primary },
  actions: { width: '100%', gap: spacing.xs, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider, backgroundColor: colors.surface },
});
