import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text } from 'react-native';
import { useReducedMotion } from '@/hooks';
import { colors, radius, spacing, typography } from '@/theme';

type StatusTone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral';
const tones = {
  primary: { background: colors.primarySoft, text: colors.primary },
  success: { background: colors.successSoft, text: colors.success },
  warning: { background: colors.warningSoft, text: '#A55C00' },
  danger: { background: colors.dangerSoft, text: colors.danger },
  neutral: { background: colors.background, text: colors.textSecondary },
};

export function StatusLabel({ label, tone = 'neutral', emphasized = false }: { label: string; tone?: StatusTone; emphasized?: boolean }) {
  const reducedMotion = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!emphasized || reducedMotion) return;

    Animated.sequence([
      Animated.timing(scale, { toValue: 1.04, duration: 120, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 140, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [emphasized, reducedMotion, scale]);

  return <Animated.View style={[styles.pill, { backgroundColor: tones[tone].background, transform: [{ scale }] }]}><Text style={[styles.label, { color: tones[tone].text }]}>{label}</Text></Animated.View>;
}

const styles = StyleSheet.create({ pill: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: spacing.xs, paddingVertical: spacing.xxs }, label: { ...typography.metadata } });
