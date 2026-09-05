import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, type GestureResponderEvent, type PressableProps } from 'react-native';
import { usePressScale, useReducedMotion } from '@/hooks';
import { playSound } from '@/services/sound';
import { colors, radius, sizing, spacing, typography } from '@/theme';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

type ButtonProps = PressableProps & {
  label: string;
  variant?: ButtonVariant;
  compact?: boolean;
  loading?: boolean;
};

const variants = {
  primary: { background: colors.primary, text: colors.surface, border: colors.primary },
  secondary: { background: colors.surface, text: colors.primary, border: colors.primary },
  ghost: { background: colors.transparent, text: colors.primary, border: colors.transparent },
  danger: { background: colors.danger, text: colors.surface, border: colors.danger },
} as const;

export function Button({ label, variant = 'primary', compact, loading, disabled, style, ...props }: ButtonProps) {
  const palette = variants[variant];
  const reducedMotion = useReducedMotion();
  const { scale, pressIn, pressOut } = usePressScale(!(disabled || loading || reducedMotion), compact ? 0.98 : 0.97);
  const containerStyle = typeof style === 'function' ? undefined : style;

  const handlePressIn = (event: GestureResponderEvent) => {
    pressIn();
    if (!(disabled || loading)) void playSound('buttonPop');
    props.onPressIn?.(event);
  };

  const handlePressOut = (event: GestureResponderEvent) => {
    pressOut();
    props.onPressOut?.(event);
  };

  return (
    <Animated.View style={[containerStyle, { transform: [{ scale }] }]}>
      <Pressable
        accessibilityRole="button"
        disabled={disabled || loading}
        style={(state) => [
          styles.base,
          compact && styles.compact,
          { backgroundColor: palette.background, borderColor: palette.border },
          state.pressed && styles.pressed,
          (disabled || loading) && styles.disabled,
          typeof style === 'function' ? style(state) : undefined,
        ]}
        {...props}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        {loading ? <ActivityIndicator color={palette.text} size="small" /> : <Text style={[styles.label, { color: palette.text }]}>{label}</Text>}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: sizing.buttonHeight, paddingHorizontal: spacing.lg, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  compact: { minHeight: sizing.buttonCompactHeight, paddingHorizontal: spacing.md },
  label: { ...typography.label },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.45 },
});
