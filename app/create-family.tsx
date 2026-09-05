import { useState } from 'react';
import { Redirect, useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Screen, TextInput } from '@/components';
import { useAuth } from '@/hooks';
import { colors, spacing, typography } from '@/theme';

export default function CreateFamilyScreen() {
  const router = useRouter();
  const { session, loading } = useAuth();
  const [familyName, setFamilyName] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!loading && !session) return <Redirect href="/welcome" />;

  const continueToMember = () => {
    const name = familyName.trim();
    if (name.length < 2) {
      setError('Escribe un nombre de al menos 2 caracteres.');
      return;
    }
    router.push({ pathname: '/first-member', params: { familyName: name } });
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <Screen scroll={false} contentStyle={styles.screen}>
        <View>
          <Pressable onPress={() => router.back()} hitSlop={12}><Text style={styles.back}>‹ Volver</Text></Pressable>
          <Text style={styles.step}>PASO 1 DE 2</Text>
          <Text style={styles.title}>¿Cómo se llama su familia?</Text>
          <Text style={styles.subtitle}>Este nombre aparecerá al elegir quién está usando la app.</Text>
        </View>
        <View style={styles.form}>
          <TextInput autoFocus label="Nombre de la familia" placeholder="Ej. Familia García" value={familyName} onChangeText={(value) => { setFamilyName(value); setError(null); }} error={error ?? undefined} returnKeyType="next" onSubmitEditing={continueToMember} />
          <Button label="Continuar" onPress={continueToMember} />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { paddingTop: spacing.md },
  back: { ...typography.bodyMedium, color: colors.primary, marginBottom: 48 },
  step: { ...typography.label, color: colors.primary },
  title: { ...typography.display, color: colors.text, marginTop: spacing.sm, maxWidth: 330 },
  subtitle: { ...typography.body, color: colors.textSecondary, fontSize: 15, lineHeight: 22, marginTop: spacing.sm, maxWidth: 330 },
  form: { gap: spacing.lg, marginTop: 48 },
});
