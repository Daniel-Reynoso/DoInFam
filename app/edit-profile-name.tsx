import { useState } from 'react';
import { Redirect, useRouter, type Href } from 'expo-router';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Screen, TextInput } from '@/components';
import { useAuth, useMemberSession } from '@/hooks';
import { updateActiveMemberProfile } from '@/services';
import { colors, spacing, typography } from '@/theme';

const settingsHref = '/settings' as Href;

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message.includes('MEMBER_SESSION')) return 'Tu sesión de integrante venció. Vuelve a introducir tu PIN.';
  return 'No pudimos guardar tu nombre. Revisa tu conexión e inténtalo nuevamente.';
}

export default function EditProfileNameScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { activeMember, refresh } = useMemberSession();
  const [name, setName] = useState(activeMember?.name ?? '');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!session) return <Redirect href="/welcome" />;
  if (!activeMember) return <Redirect href="/member-select" />;

  const save = async () => {
    const trimmed = name.trim();
    setFieldError(null);
    setFormError(null);
    if (trimmed.length < 1 || trimmed.length > 40) {
      setFieldError('Usa un nombre de hasta 40 caracteres.');
      return;
    }
    setSubmitting(true);
    try {
      await updateActiveMemberProfile(trimmed, activeMember.avatarKey);
      await refresh();
      router.replace(settingsHref);
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <Screen contentStyle={styles.screen}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace(settingsHref)} hitSlop={12}>
          <Text style={styles.back}>‹ Volver</Text>
        </Pressable>
        <Text style={styles.title}>Editar mi nombre</Text>
        <Text style={styles.subtitle}>Este nombre aparecerá en tus tareas, progreso e historial.</Text>
        <View style={styles.form}>
          <TextInput label="Nombre" maxLength={40} value={name} onChangeText={(value) => { setName(value); setFieldError(null); }} error={fieldError ?? undefined} />
          {formError ? <Text accessibilityLiveRegion="polite" style={styles.error}>{formError}</Text> : null}
          <Button label="Guardar nombre" loading={submitting} onPress={() => void save()} />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { paddingTop: spacing.md },
  back: { ...typography.bodyMedium, color: colors.primary, marginBottom: spacing.xxl },
  title: { ...typography.display, color: colors.text },
  subtitle: { ...typography.body, color: colors.textSecondary, fontSize: 15, lineHeight: 22, marginTop: spacing.xs },
  form: { gap: spacing.md, marginTop: spacing.xxl },
  error: { ...typography.caption, color: colors.danger },
});
