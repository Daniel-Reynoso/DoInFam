import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme';
import { Button } from './Button';

export function EmptyState({ title, message, actionLabel, onAction }: { title: string; message: string; actionLabel?: string; onAction?: () => void }) {
  return <View style={styles.wrapper}><MaterialCommunityIcons name="inbox-outline" size={36} color={colors.primary} /><Text style={styles.title}>{title}</Text><Text style={styles.message}>{message}</Text>{actionLabel ? <Button label={actionLabel} onPress={onAction} /> : null}</View>;
}

const styles = StyleSheet.create({ wrapper: { alignItems: 'center', gap: spacing.sm, padding: spacing.xxl }, title: { ...typography.subtitle, color: colors.text, textAlign: 'center' }, message: { ...typography.body, color: colors.textSecondary, textAlign: 'center' } });
