import { useEffect, useState } from 'react';
import { Redirect, useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, ErrorState, LoadingSkeleton, NumericInput, Screen } from '@/components';
import { useAuth, useMemberSession } from '@/hooks';
import { getHomeSummary, setWeeklyGoal } from '@/services';
import { colors, spacing, typography } from '@/theme';

function saveErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.includes('MEMBER_SESSION')) return 'Tu sesión de integrante venció. Vuelve a introducir tu PIN.';
  if (error instanceof Error && error.message.includes('INVALID_WEEKLY_GOAL')) return 'Usa una meta entre 1 y 1,000,000 puntos.';
  return 'No pudimos guardar la meta. Revisa tu conexión e inténtalo nuevamente.';
}

export default function WeeklyGoalScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { activeMember } = useMemberSession();
  const [goal, setGoal] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const summary = await getHomeSummary();
      setGoal(String(summary.goal));
    } catch (error) {
      if (error instanceof Error && error.message.includes('MEMBER_SESSION')) {
        router.replace('/member-select');
        return;
      }
      setLoadError('No pudimos cargar tu meta actual.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  if (!session) return <Redirect href="/welcome" />;
  if (!activeMember) return <Redirect href="/member-select" />;

  const save = async () => {
    const value = Number(goal);
    setFieldError(null);
    setFormError(null);
    if (!Number.isInteger(value) || value < 1 || value > 1_000_000) {
      setFieldError('Usa una meta entre 1 y 1,000,000 puntos.');
      return;
    }
    setSubmitting(true);
    try {
      await setWeeklyGoal(value);
      router.replace('/(tabs)/profile');
    } catch (error) {
      setFormError(saveErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Screen><LoadingSkeleton width={150} height={30} /><View style={styles.form}><LoadingSkeleton height={52} /><LoadingSkeleton height={48} /></View></Screen>;
  if (loadError) return <Screen scroll={false} contentStyle={styles.center}><ErrorState message={loadError} onRetry={() => void load()} /></Screen>;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <Screen contentStyle={styles.screen}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/profile')} hitSlop={12}>
          <Text style={styles.back}>‹ Volver</Text>
        </Pressable>
        <Text style={styles.title}>Cambiar meta</Text>
        <Text style={styles.subtitle}>Define cuántos puntos quiere alcanzar {activeMember.name} esta semana.</Text>
        <View style={styles.form}>
          <NumericInput
            label="Meta semanal"
            maxLength={7}
            value={goal}
            onChangeText={(value) => { setGoal(value.replace(/\D/g, '')); setFieldError(null); }}
            error={fieldError ?? undefined}
          />
          {formError ? <Text accessibilityLiveRegion="polite" style={styles.error}>{formError}</Text> : null}
          <Button label="Guardar meta" loading={submitting} onPress={() => void save()} />
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
