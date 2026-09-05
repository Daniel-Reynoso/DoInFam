import { useEffect, useState } from 'react';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, ErrorState, LoadingSkeleton, NumericInput, Screen, SegmentedControl, TextInput } from '@/components';
import { useAuth, useMemberSession } from '@/hooks';
import { createTask, deactivateTask, getTask, updateTask, type SaveTaskInput, type TaskEditorValue } from '@/services';
import { colors, radius, spacing, typography } from '@/theme';
import type { Enums } from '@/types/database';

type FieldErrors = Partial<Record<'title' | 'points' | 'quota', string>>;

function messageForSaveError(error: unknown) {
  if (error instanceof Error && error.message.includes('MEMBER_SESSION')) return 'Tu sesión de integrante venció. Vuelve a introducir tu PIN.';
  return 'No pudimos guardar la tarea. Revisa tu conexión e inténtalo nuevamente.';
}

export default function TaskFormScreen() {
  const router = useRouter();
  const { taskId } = useLocalSearchParams<{ taskId?: string }>();
  const { session } = useAuth();
  const { activeMember } = useMemberSession();
  const editing = Boolean(taskId);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [points, setPoints] = useState('10');
  const [recurrence, setRecurrence] = useState<Enums<'task_recurrence'>>('weekly');
  const [quota, setQuota] = useState('1');
  const [task, setTask] = useState<TaskEditorValue | null>(null);
  const [loading, setLoading] = useState(editing);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false);

  const loadTask = async () => {
    if (!taskId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const value = await getTask(taskId);
      setTask(value);
      setTitle(value.title);
      setDescription(value.description);
      setPoints(String(value.points));
      setRecurrence(value.recurrence);
      setQuota(String(value.quotaPerPeriod));
    } catch { setLoadError('No pudimos cargar esta tarea.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void loadTask(); }, [taskId]);

  if (!session) return <Redirect href="/welcome" />;
  if (!activeMember) return <Redirect href="/member-select" />;

  const validate = (): SaveTaskInput | null => {
    const nextErrors: FieldErrors = {};
    const pointValue = Number(points);
    const quotaValue = Number(quota);
    if (title.trim().length < 1 || title.trim().length > 80) nextErrors.title = 'Escribe un nombre de hasta 80 caracteres.';
    if (!Number.isInteger(pointValue) || pointValue < 1 || pointValue > 10000) nextErrors.points = 'Usa un valor entre 1 y 10000.';
    if (!Number.isInteger(quotaValue) || quotaValue < 1 || quotaValue > 1000) nextErrors.quota = 'Usa un valor entre 1 y 1000.';
    if (description.length > 240) setFormError('La descripción no puede superar 240 caracteres.');
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || description.length > 240) return null;
    return { title, description, points: pointValue, recurrence, quotaPerPeriod: quotaValue };
  };

  const save = async () => {
    setFormError(null);
    const value = validate();
    if (!value) return;
    setSubmitting(true);
    try {
      if (taskId) await updateTask(taskId, value);
      else await createTask(value);
      router.back();
    } catch (error) { setFormError(messageForSaveError(error)); }
    finally { setSubmitting(false); }
  };

  const handleDeactivate = async () => {
    if (!taskId) return;
    setSubmitting(true);
    try { await deactivateTask(taskId); router.back(); }
    catch (error) { setFormError(messageForSaveError(error)); setSubmitting(false); }
  };

  if (loading) return <Screen><LoadingSkeleton width={170} height={30} /><View style={styles.form}><LoadingSkeleton height={52} /><LoadingSkeleton height={84} /><LoadingSkeleton height={52} /><LoadingSkeleton height={38} /><LoadingSkeleton height={52} /></View></Screen>;
  if (loadError) return <Screen scroll={false} contentStyle={styles.center}><ErrorState message={loadError} onRetry={() => void loadTask()} /></Screen>;

  const recurrenceOptions = recurrence === 'monthly'
    ? [{ label: 'Diaria', value: 'daily' }, { label: 'Semanal', value: 'weekly' }, { label: 'Mensual', value: 'monthly' }]
    : [{ label: 'Diaria', value: 'daily' }, { label: 'Semanal', value: 'weekly' }];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <Screen contentStyle={styles.screen}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/tasks')} hitSlop={12}><Text style={styles.back}>‹ Volver</Text></Pressable>
        <Text style={styles.title}>{editing ? 'Editar tarea' : 'Nueva tarea'}</Text>
        <Text style={styles.subtitle}>{editing ? 'Actualiza lo necesario sin perder su historial.' : 'Define una acción clara y cuántos puntos entrega.'}</Text>
        <View style={styles.form}>
          <TextInput label="Nombre de la tarea" maxLength={80} placeholder="Ej. Lavar los platos" value={title} onChangeText={(value) => { setTitle(value); setErrors((current) => ({ ...current, title: undefined })); }} error={errors.title} />
          <TextInput label="Descripción (opcional)" maxLength={240} multiline numberOfLines={3} placeholder="Añade una indicación breve" value={description} onChangeText={setDescription} style={styles.description} />
          <NumericInput label="Puntos" maxLength={5} value={points} onChangeText={(value) => { setPoints(value.replace(/\D/g, '')); setErrors((current) => ({ ...current, points: undefined })); }} error={errors.points} />
          <View style={styles.field}><Text style={styles.label}>Frecuencia</Text><SegmentedControl options={recurrenceOptions} value={recurrence} onChange={(value) => setRecurrence(value as Enums<'task_recurrence'>)} /></View>
          <NumericInput label={recurrence === 'daily' ? 'Cupos por día' : recurrence === 'monthly' ? 'Cupos por mes' : 'Cupos por semana'} maxLength={4} value={quota} onChangeText={(value) => { setQuota(value.replace(/\D/g, '')); setErrors((current) => ({ ...current, quota: undefined })); }} error={errors.quota} />
          {formError ? <Text accessibilityLiveRegion="polite" style={styles.error}>{formError}</Text> : null}
          <Button label={editing ? 'Guardar cambios' : 'Crear tarea'} loading={submitting} onPress={() => void save()} />
          {editing && task?.isActive && !confirmingDeactivate ? <Button label="Desactivar tarea" variant="ghost" disabled={submitting} onPress={() => setConfirmingDeactivate(true)} /> : null}
          {editing && task?.isActive && confirmingDeactivate ? (
            <View style={styles.confirmation}>
              <Text style={styles.confirmationTitle}>¿Desactivar esta tarea?</Text>
              <Text style={styles.confirmationCopy}>Dejará de estar disponible, pero conservará su historial.</Text>
              <View style={styles.confirmationActions}>
                <View style={styles.confirmationButton}><Button compact label="Cancelar" variant="secondary" disabled={submitting} onPress={() => setConfirmingDeactivate(false)} /></View>
                <View style={styles.confirmationButton}><Button compact label="Desactivar" variant="danger" loading={submitting} onPress={() => void handleDeactivate()} /></View>
              </View>
            </View>
          ) : null}
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
  field: { gap: spacing.xs },
  label: { ...typography.label, color: colors.text },
  description: { minHeight: 84, paddingTop: spacing.md, textAlignVertical: 'top' },
  error: { ...typography.caption, color: colors.danger },
  center: { alignItems: 'center', justifyContent: 'center' },
  confirmation: { gap: spacing.xs, padding: spacing.md, borderWidth: 1, borderColor: colors.danger, borderRadius: radius.md, backgroundColor: colors.dangerSoft },
  confirmationTitle: { ...typography.label, color: colors.text },
  confirmationCopy: { ...typography.caption, color: colors.textSecondary },
  confirmationActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  confirmationButton: { flex: 1 },
});
