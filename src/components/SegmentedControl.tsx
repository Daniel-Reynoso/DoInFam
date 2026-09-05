import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';

type Option = { label: string; value: string };

export function SegmentedControl({ options, value, onChange }: { options: Option[]; value: string; onChange: (value: string) => void }) {
  return (
    <View style={styles.track}>
      {options.map((option) => {
        const active = option.value === value;
        return <Pressable key={option.value} onPress={() => onChange(option.value)} style={[styles.option, active && styles.active]}><Text style={[styles.label, active && styles.activeLabel]}>{option.label}</Text></Pressable>;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { minHeight: 38, flexDirection: 'row', alignItems: 'center', padding: 3, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  option: { flex: 1, minHeight: 30, paddingHorizontal: spacing.sm, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  active: { backgroundColor: colors.primary },
  label: { ...typography.metadata, color: colors.textSecondary },
  activeLabel: { color: colors.surface },
});
