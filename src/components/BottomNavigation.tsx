import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, sizing, spacing, typography } from '@/theme';

type NavItem = { key: string; label: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'] };

type Props = { items: NavItem[]; activeKey: string; onPress: (key: string) => void };

export function BottomNavigation({ items, activeKey, onPress }: Props) {
  return (
    <View style={styles.bar}>
      {items.map((item) => {
        const active = item.key === activeKey;
        return (
          <Pressable key={item.key} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => onPress(item.key)} style={styles.item}>
            <MaterialCommunityIcons name={item.icon} size={21} color={active ? colors.primary : colors.textSecondary} />
            <Text style={[styles.label, active && styles.activeLabel]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: sizing.tabBarHeight, flexDirection: 'row', backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingBottom: spacing.xs },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  label: { ...typography.metadata, color: colors.textSecondary },
  activeLabel: { color: colors.primary },
});
