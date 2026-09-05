import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme';
import { ProgressBar } from './ProgressBar';

type Props = { points: number; goal: number; daysLeft: number };

export function WeeklyProgressSummary({ points, goal, daysLeft }: Props) {
  const remaining = Math.max(goal - points, 0);
  const dayLabel = daysLeft === 1 ? 'día' : 'días';
  return (
    <View style={styles.wrapper}>
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>PROGRESO SEMANAL</Text>
        <Text><Text style={styles.points}>{points}</Text><Text style={styles.goal}> / {goal} pts</Text></Text>
      </View>
      <ProgressBar value={goal > 0 ? points / goal : 0} />
      <Text style={styles.helper}>{remaining > 0 ? <>Te faltan <Text style={styles.emphasis}>{remaining} pts</Text></> : <Text style={styles.emphasis}>Meta cumplida</Text>} · Quedan {daysLeft} {dayLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xs },
  heading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  eyebrow: { ...typography.metadata, color: colors.textSecondary },
  points: { ...typography.subtitle, color: colors.text },
  goal: { ...typography.caption, color: colors.textSecondary },
  helper: { ...typography.caption, color: colors.textSecondary },
  emphasis: { color: colors.primary, fontFamily: typography.label.fontFamily },
});
