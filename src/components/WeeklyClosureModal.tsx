import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
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
  const message = useMemo(() => closure ? pickMessage(closure) : '', [closure]);

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
        <View style={styles.card}>
          <View style={[styles.icon, closure.goalReached ? styles.successIcon : styles.warningIcon]}>
            <MaterialCommunityIcons name={closure.goalReached ? 'party-popper' : 'weather-sunset'} size={30} color={colors.surface} />
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

          {closure.topTasks.length > 0 ? (
            <View style={styles.tasks}>
              {closure.topTasks.map((task) => (
                <View key={task.id} style={styles.taskRow}>
                  <Text numberOfLines={1} style={styles.taskTitle}>{task.title}</Text>
                  <Text style={styles.taskPoints}>+{task.points} pts</Text>
                </View>
              ))}
            </View>
          ) : null}

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
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.overlay, padding: spacing.xl },
  card: { width: '100%', maxWidth: 360, alignItems: 'center', borderRadius: radius.xl, backgroundColor: colors.surface, padding: spacing.xl, gap: spacing.sm },
  icon: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  successIcon: { backgroundColor: colors.primary },
  warningIcon: { backgroundColor: colors.warning },
  kicker: { ...typography.label, color: colors.primary, textTransform: 'uppercase', marginTop: spacing.xs },
  title: { ...typography.display, color: colors.text, textAlign: 'center' },
  subtitle: { ...typography.caption, color: colors.textSecondary },
  scoreCard: { width: '100%', padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.background, gap: spacing.xs, marginTop: spacing.xs },
  score: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },
  scoreStrong: { ...typography.display, color: colors.text },
  progressTrack: { height: 8, overflow: 'hidden', borderRadius: 4, backgroundColor: colors.divider },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: colors.primary },
  scoreHint: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },
  message: { ...typography.bodyMedium, color: colors.text, textAlign: 'center' },
  consequence: { width: '100%', borderWidth: 1, borderColor: colors.warning, borderRadius: radius.md, padding: spacing.md, backgroundColor: colors.warningSoft },
  consequenceLabel: { ...typography.label, color: colors.warning, textTransform: 'uppercase' },
  consequenceText: { ...typography.body, color: colors.text, marginTop: spacing.xxs },
  tasks: { width: '100%', overflow: 'hidden', borderWidth: 1, borderColor: colors.divider, borderRadius: radius.md },
  taskRow: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  taskTitle: { ...typography.body, color: colors.text, flex: 1 },
  taskPoints: { ...typography.label, color: colors.primary },
  actions: { width: '100%', gap: spacing.sm, marginTop: spacing.xs },
});
