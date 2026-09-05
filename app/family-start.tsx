import { Redirect, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Screen } from '@/components';
import { useAuth } from '@/hooks';
import { colors, spacing, typography } from '@/theme';

export default function FamilyStartScreen() {
  const router = useRouter();
  const { session, loading } = useAuth();

  if (!loading && !session) return <Redirect href="/welcome" />;

  return (
    <Screen scroll={false} contentStyle={styles.screen}>
      <View style={styles.copy}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/welcome')} hitSlop={12} style={styles.backWrapper}>
          <Text style={styles.back}>‹ Volver</Text>
        </Pressable>
        <Text style={styles.brand}>DOINFAM</Text>
        <Text style={styles.title}>Crea tu familia</Text>
        <Text style={styles.subtitle}>
          Este paso es para quien está configurando DoInFam por primera vez. Después podrás compartir el código familiar.
        </Text>
      </View>

      <View style={styles.actions}>
        <Button label="Continuar" onPress={() => router.push('/create-family')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { justifyContent: 'space-between', paddingTop: spacing.md },
  copy: { alignItems: 'center', paddingTop: 40 },
  backWrapper: { alignSelf: 'flex-start', marginBottom: 48 },
  back: { ...typography.bodyMedium, color: colors.primary },
  brand: { ...typography.label, color: colors.primary, fontSize: 15, lineHeight: 20 },
  title: { ...typography.display, color: colors.text, marginTop: spacing.sm, maxWidth: 330, textAlign: 'center' },
  subtitle: { ...typography.body, color: colors.textSecondary, fontSize: 15, lineHeight: 22, marginTop: spacing.sm, maxWidth: 330, textAlign: 'center' },
  actions: { gap: spacing.sm, paddingBottom: spacing.xl },
});
