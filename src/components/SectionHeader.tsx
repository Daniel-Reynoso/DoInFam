import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/theme';

type Props = { title: string; actionLabel?: string; onAction?: () => void; collapsible?: boolean };

export function SectionHeader({ title, actionLabel, onAction, collapsible }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title.toUpperCase()}</Text>
      {actionLabel ? <Pressable onPress={onAction}><Text style={styles.action}>{actionLabel}</Text></Pressable> : null}
      {collapsible ? <MaterialCommunityIcons name="chevron-down" size={18} color={colors.textSecondary} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({ row: { minHeight: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, title: { ...typography.metadata, color: colors.textSecondary, flex: 1 }, action: { ...typography.label, color: colors.primary } });
