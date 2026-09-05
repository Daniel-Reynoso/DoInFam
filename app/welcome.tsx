import { Redirect, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Screen } from '@/components';
import { useAuth } from '@/hooks';
import { colors, spacing, typography } from '@/theme';

export default function WelcomeScreen() {
  const router = useRouter();
  const { session } = useAuth();

  if (session) return <Redirect href="/" />;

  return (
    <Screen scroll={false} contentStyle={styles.screen}>
      <View style={styles.copy}>
        <Text style={styles.brand}>DOINFAM</Text>
        <Text style={styles.title}>Las tareas de casa, en equipo.</Text>
        <Text style={styles.subtitle}>
          Organicen la semana, sumen puntos y avancen juntos hacia sus metas.
        </Text>
      </View>
      <View style={styles.actions}>
        <Button label="Tengo código familiar" onPress={() => router.push('/join-family')} />
        <Button label="Crear una familia" variant="secondary" onPress={() => router.push({ pathname: '/account', params: { mode: 'signup' } })} />
        <Button label="Ya tengo cuenta" variant="ghost" onPress={() => router.push({ pathname: '/account', params: { mode: 'signin' } })} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { justifyContent: 'space-between', paddingTop: 0 },
  copy: { alignItems: 'center', paddingTop: 170 },
  brand: { ...typography.label, color: colors.primary, fontSize: 15, lineHeight: 20 },
  title: { ...typography.display, color: colors.text, marginTop: spacing.lg, textAlign: 'center', maxWidth: 320 },
  subtitle: { ...typography.body, color: colors.textSecondary, fontSize: 15, lineHeight: 22, marginTop: spacing.md, textAlign: 'center', maxWidth: 320 },
  actions: { gap: spacing.sm, paddingBottom: spacing.xxxl },
});
