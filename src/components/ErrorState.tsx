import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme';
import { Button } from './Button';

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <View style={styles.wrapper}><MaterialCommunityIcons name="alert-circle-outline" size={36} color={colors.danger} /><Text style={styles.title}>Algo salió mal</Text><Text style={styles.message}>{message}</Text>{onRetry ? <Button label="Reintentar" variant="secondary" onPress={onRetry} /> : null}</View>;
}

const styles = StyleSheet.create({ wrapper: { alignItems: 'center', gap: spacing.sm, padding: spacing.xxl }, title: { ...typography.subtitle, color: colors.text }, message: { ...typography.body, color: colors.textSecondary, textAlign: 'center' } });
