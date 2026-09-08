import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { usePressScale, useReducedMotion } from '@/hooks';
import { colors, fontFamilies, spacing, typography } from '@/theme';
import type { FamilyMember } from '@/types';
import { Avatar } from './Avatar';
import { StatusLabel } from './StatusLabel';

type Props = {
  member: FamilyMember;
  rank?: number;
  selectable?: boolean;
  lastAccess?: boolean;
  onPress?: () => void;
  variant?: 'default' | 'selector';
  last?: boolean;
  entryIndex?: number;
};

export function FamilyMemberRow({
  member,
  rank,
  selectable,
  lastAccess,
  onPress,
  variant = 'default',
  last = false,
  entryIndex = 0,
}: Props) {
  const reachedGoal = !member.isResting && member.points >= member.goal;
  const isSelector = variant === 'selector';
  const reducedMotion = useReducedMotion();
  const entrance = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const { scale, pressIn, pressOut } = usePressScale(Boolean(selectable) && !reducedMotion, 0.985);

  useEffect(() => {
    if (reducedMotion) {
      entrance.setValue(1);
      return;
    }

    Animated.timing(entrance, {
      toValue: 1,
      duration: 220,
      delay: Math.min(entryIndex, 5) * 35,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [entrance, entryIndex, reducedMotion]);

  const translateY = entrance.interpolate({ inputRange: [0, 1], outputRange: [8, 0] });

  return (
    <Animated.View style={{ opacity: entrance, transform: [{ translateY }, { scale }] }}>
      <Pressable
        accessibilityRole={selectable ? 'button' : undefined}
        disabled={!selectable}
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={({ pressed }) => [
          styles.row,
          isSelector && styles.selectorRow,
          last && styles.lastRow,
          pressed && styles.pressed,
        ]}
      >
        {rank ? <Text style={styles.rank}>#{rank}</Text> : null}
        <Avatar
          initial={member.initial}
          size={isSelector ? 'selector' : 'sm'}
          tone={member.avatarTone}
        />
        <View style={styles.content}>
          <Text style={[styles.name, isSelector && styles.selectorName]}>{member.name}</Text>
          {lastAccess ? <Text style={styles.note}>Último acceso</Text> : !isSelector && member.note ? <Text style={styles.note}>{member.note}</Text> : null}
        </View>
        {!selectable && member.isResting ? <StatusLabel label="En descanso" tone="primary" /> : null}
        {!selectable && reachedGoal ? <StatusLabel label="Meta cumplida" tone="success" /> : null}
        {!selectable ? <View style={styles.score}><Text style={styles.points}>{member.points}</Text><Text style={styles.goal}>/{member.goal} pts</Text></View> : null}
        {selectable ? <MaterialCommunityIcons name="chevron-right" color={colors.textSecondary} size={isSelector ? 30 : 22} /> : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 68, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, gap: spacing.sm, backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  selectorRow: { minHeight: 80, paddingHorizontal: spacing.lg, gap: spacing.md, backgroundColor: colors.background, borderBottomColor: colors.border },
  lastRow: { borderBottomWidth: 0 },
  pressed: { backgroundColor: colors.primarySoft },
  rank: { width: 24, ...typography.metadata, color: colors.textSecondary },
  content: { flex: 1 },
  name: { ...typography.bodyMedium, color: colors.text },
  selectorName: { fontFamily: fontFamilies.semibold, fontSize: 16, lineHeight: 21 },
  note: { ...typography.metadata, color: colors.textSecondary, marginTop: 2 },
  score: { alignItems: 'flex-end' },
  points: { ...typography.subtitle, color: colors.text },
  goal: { ...typography.metadata, color: colors.textSecondary },
});
