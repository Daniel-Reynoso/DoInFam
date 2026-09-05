import { StyleSheet, View, type ViewStyle } from 'react-native';
import { colors, radius } from '@/theme';

export function LoadingSkeleton({ width = '100%', height = 16, style }: { width?: ViewStyle['width']; height?: number; style?: ViewStyle }) {
  return <View accessibilityLabel="Cargando" style={[styles.skeleton, { width, height }, style]} />;
}

const styles = StyleSheet.create({ skeleton: { borderRadius: radius.sm, backgroundColor: colors.divider } });
