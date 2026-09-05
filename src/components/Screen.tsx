import type { PropsWithChildren } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { colors, sizing, spacing } from '@/theme';

type Props = PropsWithChildren<{ scroll?: boolean; contentStyle?: ViewStyle }>;

export function Screen({ children, scroll = true, contentStyle }: Props) {
  const content = <View style={[styles.content, contentStyle]}>{children}</View>;
  return <SafeAreaView edges={['top']} style={styles.safe}>{scroll ? <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>{content}</ScrollView> : content}</SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.background }, scroll: { flexGrow: 1, alignItems: 'center' }, content: { width: '100%', maxWidth: sizing.screenMaxWidth, alignSelf: 'center', flex: 1, paddingHorizontal: sizing.horizontalPadding, paddingTop: spacing.md, paddingBottom: spacing.xxl } });
