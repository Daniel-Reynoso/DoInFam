import { useState } from 'react';
import { useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Screen, TextInput } from '@/components';
import { useAuth } from '@/hooks';
import { joinFamilyByCode } from '@/services';
import { signInAnonymousFamilyAccess } from '@/services/auth';
import { colors, spacing, typography } from '@/theme';

function messageForJoinError(error: unknown) {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes('invalid_family_code')) return 'Ese código no existe. Revísalo e inténtalo nuevamente.';
    if (message.includes('user_already_has_family')) return 'Esta cuenta ya pertenece a otra familia.';
    if (message.includes('anonymous') || message.includes('provider')) return 'El acceso por código aún no está activo en Supabase. Revisa Anonymous Sign-Ins.';
  }
  return 'No pudimos unir esta cuenta. Revisa tu conexión e inténtalo nuevamente.';
}

export default function JoinFamilyScreen() {
  const router = useRouter();
  const { session, loading } = useAuth();
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const normalizedCode = code.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    setError(null);
    if (normalizedCode.length !== 8) {
      setError('El código familiar tiene 8 caracteres.');
      return;
    }

    setSubmitting(true);
    try {
      if (!session) {
        await signInAnonymousFamilyAccess();
      }
      await joinFamilyByCode(normalizedCode);
      router.replace('/member-select');
    } catch (nextError) {
      setError(messageForJoinError(nextError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <Screen scroll={false} contentStyle={styles.screen}>
        <View>
          <Pressable onPress={() => router.replace('/welcome')} hitSlop={12}>
            <Text style={styles.back}>‹ Volver</Text>
          </Pressable>
          <Text style={styles.step}>CÓDIGO FAMILIAR</Text>
          <Text style={styles.title}>Ingresa el código familiar</Text>
          <Text style={styles.subtitle}>
            No necesitas correo. Con este código verás los perfiles existentes y podrás crear el tuyo.
          </Text>
        </View>

        <View style={styles.form}>
          <TextInput
            autoCapitalize="characters"
            autoCorrect={false}
            label="Código"
            maxLength={8}
            placeholder="Ej. A1B2C3D4"
            value={code}
            onChangeText={(value) => {
              setCode(value.replace(/[^A-Za-z0-9]/g, '').toUpperCase());
              setError(null);
            }}
            error={error ?? undefined}
            returnKeyType="done"
            onSubmitEditing={() => void submit()}
          />
          <Button label="Continuar" loading={submitting || loading} onPress={() => void submit()} />
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
