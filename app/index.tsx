import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAuth, useMemberSession } from '@/hooks';
import { colors } from '@/theme';

export default function Index() {
  const { session, loading: authLoading } = useAuth();
  const { activeMember, loading: memberLoading } = useMemberSession();

  if (authLoading || memberLoading) {
    return <View style={styles.loading}><ActivityIndicator color={colors.primary} /></View>;
  }

  if (!session) return <Redirect href="/welcome" />;
  if (activeMember) return <Redirect href="/(tabs)" />;
  return <Redirect href="/member-select" />;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
});
