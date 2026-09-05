import { forwardRef } from 'react';
import { StyleSheet, Text, TextInput as NativeTextInput, View, type TextInputProps as NativeTextInputProps } from 'react-native';
import { colors, radius, sizing, spacing, typography } from '@/theme';

type TextInputProps = NativeTextInputProps & { label?: string; error?: string };

export const TextInput = forwardRef<NativeTextInput, TextInputProps>(({ label, error, style, ...props }, ref) => (
  <View style={styles.wrapper}>
    {label ? <Text style={styles.label}>{label}</Text> : null}
    <NativeTextInput ref={ref} placeholderTextColor={colors.textSecondary} style={[styles.input, error && styles.inputError, style]} {...props} />
    {error ? <Text style={styles.error}>{error}</Text> : null}
  </View>
));

TextInput.displayName = 'TextInput';

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xs },
  label: { ...typography.label, color: colors.text },
  input: { minHeight: sizing.inputHeight, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: spacing.md, color: colors.text, ...typography.body },
  inputError: { borderColor: colors.danger },
  error: { ...typography.caption, color: colors.danger },
});
