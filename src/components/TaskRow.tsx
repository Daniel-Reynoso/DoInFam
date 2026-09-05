import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { usePressScale, useReducedMotion } from '@/hooks';
import { colors, radius, spacing, typography } from '@/theme';
import type { Task } from '@/types';
import { Button } from './Button';
import { StatusLabel } from './StatusLabel';

type TaskRowProps = { task: Task; onPress?: () => void; onComplete?: () => void; completing?: boolean; showAction?: boolean; entryIndex?: number };

export function TaskRow({ task, onPress, onComplete, completing = false, showAction = true, entryIndex = 0 }: TaskRowProps) {
  const exhausted = task.status === 'exhausted' || task.status === 'inactive' || task.status === 'done-today';
  const reducedMotion = useReducedMotion();
  const entrance = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const { scale, pressIn, pressOut } = usePressScale(Boolean(onPress) && !reducedMotion, 0.985);

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
    <Animated.View style={{ opacity: entrance, transform: [{ translateY }] }}>
      <View style={[styles.row, exhausted && styles.exhaustedRow]}>
        <Animated.View style={[styles.contentWrap, { transform: [{ scale }] }]}>
          <Pressable
            accessibilityRole={onPress ? 'button' : undefined}
            disabled={!onPress}
            onPress={onPress}
            onPressIn={pressIn}
            onPressOut={pressOut}
            style={({ pressed }) => [styles.content, pressed && onPress ? styles.pressed : null]}
          >
            <Text numberOfLines={1} style={styles.title}>{task.title}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.points}>+{task.points} pts</Text>
              <Text style={styles.quota}>{task.quotaLabel}</Text>
              {task.status === 'last-slot' ? <StatusLabel label="Último cupo" tone="warning" emphasized /> : null}
              {task.status === 'done-today' ? <StatusLabel label="Hecha hoy" tone="neutral" /> : null}
              {task.status === 'exhausted' ? <StatusLabel label="Cupo agotado" tone="danger" /> : null}
              {task.status === 'inactive' ? <StatusLabel label="Inactiva" tone="neutral" /> : null}
            </View>
          </Pressable>
        </Animated.View>
        {showAction ? (
          task.status === 'completed'
            ? <StatusLabel label="Completada" tone="success" />
            : <Button compact disabled={exhausted || !onComplete} label="Completar" loading={completing} onPress={onComplete} />
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  exhaustedRow: { opacity: 0.72 },
  contentWrap: { flex: 1 },
  content: { flex: 1, gap: spacing.xxs },
  title: { ...typography.bodyMedium, color: colors.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.xs },
  points: { ...typography.metadata, color: colors.primary },
  quota: { ...typography.metadata, color: colors.textSecondary },
  pressed: { backgroundColor: colors.primarySoft, borderRadius: radius.sm },
});
