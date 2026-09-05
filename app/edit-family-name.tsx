import { useEffect, useState } from 'react';
import { Redirect, useRouter, type Href } from 'expo-router';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, ErrorState, LoadingSkeleton, Screen, TextInput } from '@/components';
import { useAuth, useMemberSession } from '@/hooks';
import { getFamilyRoster, updateFamilyName } from '@/services';
import { colors, spacing, typography } from '@/theme';

const settingsHref = '/settings' as Href;

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message.includes('MEMBER_SESSION')) return 'Tu sesión de integrante venció. Vuelve a introducir tu PIN.';
  return 'No pudimos guardar el nombre de la familia. Revisa tu conexión e inténtalo nuevamente.';
}

export default function EditFamilyNameScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { activeMember } = useMemberSession();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const roster = await getFamilyRoster();
      setName(roster.familyName);
    } catch {
      setLoadError('No pudimos cargar el nombre de la familia.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  if (!session) return <Redirect href="/welcome" />;
  if (!activeMember) return <Redirect href="/member-select" />;

  const save = async () => {
    const trimmed = name.trim();
    setFieldError(null);
    setFormError(null);
    if (trimmed.length < 1 || trimmed.length > 60) {
      setFieldError('Usa un nombre de hasta 60 caracteres.');
      return;
    }
    setSubmitting(true);
    try {
      await updateFamilyName(trimmed);
      router.replace(settingsHref);
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Screen><LoadingSkeleton width={230} height={30} /><View style={styles.form}><LoadingSkeleton height={52} /><LoadingSkeleton height={46} /></View></Screen>;
  if (loadError) return <Screen scroll={false} contentStyle={styles.center}><ErrorState message={loadError} onRetry={() => void load()} /></Screen>;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <Screen contentStyle={styles.screen}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace(settingsHref)} hitSlop={12}>
          <Text style={styles.back}>‹ Volver</Text>
        </Pressable>
        <Text style={styles.title}>Nombre de familia</Text>
        <Text style={styles.subtitle}>Cualquier integrante puede cambiar solo el nombre familiar.</Text>
        <View style={styles.form}>
          <TextInput label="Familia" maxLength={60} value={name} onChangeText={(value) => { setName(value); setFieldError(null); }} error={fieldError ?? undefined} />
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
  center: { alignItems: 'center', justifyContent: 'center' },
});
