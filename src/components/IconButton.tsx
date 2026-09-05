import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';
import { colors, radius, sizing } from '@/theme';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

type IconButtonProps = {
  icon: IconName;
  onPress?: () => void;
  label: string;
  size?: number;
};

export function IconButton({ icon, onPress, label, size = sizing.iconLg }: IconButtonProps) {
  return (
    <Pressable accessibilityLabel={label} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <MaterialCommunityIcons name={icon} color={colors.text} size={size} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  pressed: { backgroundColor: colors.primarySoft },
});
