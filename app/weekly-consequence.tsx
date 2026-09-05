import { useEffect, useState } from 'react';
import { Redirect, useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, ErrorState, LoadingSkeleton, Screen, TextInput } from '@/components';
import { useAuth, useMemberSession } from '@/hooks';
import { getFamilyProgress, setWeeklyConsequence } from '@/services';
import { colors, spacing, typography } from '@/theme';

function saveErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.includes('MEMBER_SESSION')) return 'Tu sesión de integrante venció. Vuelve a introducir tu PIN.';
  return 'No pudimos guardar la consecuencia. Revisa tu conexión e inténtalo nuevamente.';
}

export default function WeeklyConsequenceScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { activeMember } = useMemberSession();
  const [consequence, setConsequence] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const progress = await getFamilyProgress();
      setConsequence(progress.consequence ?? '');
    } catch (error) {
      if (error instanceof Error && error.message.includes('MEMBER_SESSION')) {
        router.replace('/member-select');
        return;
      }
      setLoadError('No pudimos cargar la consecuencia actual.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  if (!session) return <Redirect href="/welcome" />;
  if (!activeMember) return <Redirect href="/member-select" />;

  const save = async () => {
    const trimmed = consequence.trim();
    setFieldError(null);
    setFormError(null);
    if (trimmed.length > 180) {
      setFieldError('Usa hasta 180 caracteres.');
      return;
    }
    setSubmitting(true);
    try {
      await setWeeklyConsequence(trimmed);
      router.replace('/(tabs)/family');
    } catch (error) {
      setFormError(saveErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Screen><LoadingSkeleton width={240} height={30} /><View style={styles.form}><LoadingSkeleton height={96} /><LoadingSkeleton height={48} /></View></Screen>;
  if (loadError) return <Screen scroll={false} contentStyle={styles.center}><ErrorState message={loadError} onRetry={() => void load()} /></Screen>;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <Screen contentStyle={styles.screen}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/family')} hitSlop={12}>
          <Text style={styles.back}>‹ Volver</Text>
        </Pressable>
        <Text style={styles.title}>Consecuencia semanal</Text>
        <Text style={styles.subtitle}>Escribe qué pasará si alguien no llega a su meta al cerrar la semana.</Text>
        <View style={styles.form}>
          <TextInput
            label="Consecuencia"
            maxLength={180}
            multiline
            numberOfLines={4}
            placeholder="Ej. Quien no alcance su meta lava los trastes del domingo."
            value={consequence}
            onChangeText={(value) => { setConsequence(value); setFieldError(null); }}
            error={fieldError ?? undefined}
            style={styles.textarea}
          />
          <Text style={styles.helper}>Déjala vacía para quitar la consecuencia de esta semana.</Text>
          {formError ? <Text accessibilityLiveRegion="polite" style={styles.error}>{formError}</Text> : null}
          <Button label="Guardar consecuencia" loading={submitting} onPress={() => void save()} />
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
  textarea: { minHeight: 108, paddingTop: spacing.md, textAlignVertical: 'top' },
  helper: { ...typography.caption, color: colors.textSecondary },
  error: { ...typography.caption, color: colors.danger },
  center: { alignItems: 'center', justifyContent: 'center' },
});
