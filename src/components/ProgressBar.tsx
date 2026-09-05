import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useReducedMotion } from '@/hooks';
import { clamp } from '@/utils/format';
import { colors, radius } from '@/theme';

type ProgressBarProps = { value: number; color?: string; height?: number };

export function ProgressBar({ value, color = colors.primary, height = 8 }: ProgressBarProps) {
  const reducedMotion = useReducedMotion();
  const progress = useRef(new Animated.Value(clamp(value))).current;
  const safeValue = clamp(value);

  useEffect(() => {
    if (reducedMotion) {
      progress.setValue(safeValue);
      return;
    }

    Animated.timing(progress, {
      toValue: safeValue,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress, reducedMotion, safeValue]);

  const width = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(safeValue * 100) }} style={[styles.track, { height, borderRadius: height / 2 }]}>
      <Animated.View style={[styles.fill, { width, backgroundColor: color, borderRadius: height / 2 }]} />
    </View>
  );
}

const styles = StyleSheet.create({ track: { width: '100%', backgroundColor: colors.divider, overflow: 'hidden' }, fill: { height: '100%' } });
