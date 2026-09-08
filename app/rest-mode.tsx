import { useEffect, useState } from 'react';
import { Redirect, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, ErrorState, LoadingSkeleton, Screen, StatusLabel } from '@/components';
import { useAuth, useMemberSession } from '@/hooks';
import { disableRestMode, enableRestMode, getRestMode, type RestDuration, type RestMode } from '@/services';
import { playSound } from '@/services/sound';
import { colors, radius, spacing, typography } from '@/theme';

const endFormatter = new Intl.DateTimeFormat('es-PE', {
  timeZone: 'America/Lima',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

export default function RestModeScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { activeMember } = useMemberSession();
  const [restMode, setRestMode] = useState<RestMode | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<RestDuration>('this_week');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<'enable' | 'disable' | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await getRestMode();
      setRestMode(next);
      if (next.duration) setSelectedDuration(next.duration);
    } catch {
      setError('No pudimos cargar el modo descanso. Revisa tu conexión e inténtalo nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  if (!session) return <Redirect href="/welcome" />;
  if (!activeMember) return <Redirect href="/member-select" />;

  const save = async () => {
    if (saving || !confirmation) return;
    const action = confirmation;
    setConfirmation(null);
    setSaving(true);
    setError(null);
    try {
      const next = action === 'enable'
        ? await enableRestMode(selectedDuration)
        : await disableRestMode();
      setRestMode(next);
    } catch {
      setError(action === 'enable'
        ? 'No pudimos activar el descanso. Inténtalo nuevamente.'
        : 'No pudimos desactivar el descanso. Inténtalo nuevamente.');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !restMode) {
    return <Screen><View style={styles.header}><LoadingSkeleton width={40} height={40} style={styles.rounded} /><LoadingSkeleton width={190} height={34} /><View style={styles.headerSpacer} /></View><View style={styles.loading}><LoadingSkeleton width={96} height={96} style={styles.heroSkeleton} /><LoadingSkeleton height={120} /><LoadingSkeleton height={76} /></View></Screen>;
  }

  if (error && !restMode) {
    return <Screen scroll={false} contentStyle={styles.center}><ErrorState message={error} onRetry={() => void load()} /></Screen>;
  }

  const active = restMode?.active === true;
  const durationLabel = restMode?.duration === 'until_disabled'
    ? 'Hasta que lo desactives'
    : restMode?.endsAt
      ? `Hasta el ${endFormatter.format(new Date(restMode.endsAt))}`
      : 'Solo esta semana';

  return (
    <Screen contentStyle={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Volver" onPress={() => router.canGoBack() ? router.back() : router.replace('/settings')} hitSlop={12} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <MaterialCommunityIcons name="arrow-left" size={30} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Modo descanso</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.hero}>
        <View style={styles.heroIcon}><MaterialCommunityIcons name="weather-sunset" size={48} color={colors.primary} /></View>
        <Text style={styles.heroTitle}>{active ? 'Estás en descanso' : '¿Estarás fuera de casa?'}</Text>
        <Text style={styles.heroBody}>{active
          ? 'Tus tareas están pausadas y tu meta no se evaluará si sigues en descanso al cerrar la semana.'
          : 'Pausa tus tareas cuando estés de viaje o no puedas participar. Los puntos que ya ganaste se conservan.'}</Text>
      </View>

      {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}

      {active ? (
        <>
          <View style={styles.activeCard}>
            <View style={styles.activeHeading}><StatusLabel label="EN DESCANSO" tone="primary" /><MaterialCommunityIcons name="pause-circle-outline" size={26} color={colors.primary} /></View>
            <Text style={styles.activeLabel}>{durationLabel}</Text>
            <Text style={styles.activeHint}>Puedes volver cuando quieras. Al desactivarlo, las tareas reaparecen inmediatamente y esta semana vuelve a evaluarse.</Text>
          </View>
          <Button label="Desactivar modo descanso" variant="secondary" loading={saving} onPress={() => setConfirmation('disable')} />
        </>
      ) : (
        <>
          <Text style={styles.sectionLabel}>¿Por cuánto tiempo?</Text>
          <View style={styles.options}>
            <DurationOption
              selected={selectedDuration === 'this_week'}
              title="Solo esta semana"
              subtitle="Termina automáticamente el lunes."
              onPress={() => { void playSound('buttonPop'); setSelectedDuration('this_week'); }}
            />
            <DurationOption
              selected={selectedDuration === 'until_disabled'}
              title="Hasta que lo desactive"
              subtitle="Sigue activo hasta que decidas volver."
              onPress={() => { void playSound('buttonPop'); setSelectedDuration('until_disabled'); }}
              last
            />
          </View>
          <View style={styles.note}><MaterialCommunityIcons name="information-outline" size={22} color={colors.textSecondary} /><Text style={styles.noteText}>El cambio se aplica ahora. Si vuelves durante la semana, conservarás tus puntos y tendrás la meta completa.</Text></View>
          <Button label="Activar modo descanso" loading={saving} onPress={() => setConfirmation('enable')} />
        </>
      )}

      <Modal transparent animationType="fade" visible={confirmation !== null} onRequestClose={() => setConfirmation(null)}>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIcon}><MaterialCommunityIcons name={confirmation === 'enable' ? 'weather-sunset' : 'home-heart'} size={32} color={colors.primary} /></View>
            <Text style={styles.modalTitle}>{confirmation === 'enable' ? '¿Activar el descanso?' : '¿Volver a participar?'}</Text>
            <Text style={styles.modalBody}>{confirmation === 'enable'
              ? 'Las tareas se pausarán desde ahora. Los puntos que ya ganaste no se borrarán.'
              : 'Las tareas volverán ahora y tu resultado de esta semana se evaluará normalmente.'}</Text>
            <View style={styles.modalActions}>
              <Button label="Cancelar" variant="ghost" compact onPress={() => setConfirmation(null)} style={styles.modalButton} />
              <Button label={confirmation === 'enable' ? 'Activar' : 'Volver'} compact onPress={() => void save()} style={styles.modalButton} />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function DurationOption({ selected, title, subtitle, onPress, last = false }: { selected: boolean; title: string; subtitle: string; onPress: () => void; last?: boolean }) {
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={onPress} style={({ pressed }) => [styles.option, last && styles.optionLast, selected && styles.optionSelected, pressed && styles.pressed]}>
      <View style={[styles.radio, selected && styles.radioSelected]}>{selected ? <View style={styles.radioDot} /> : null}</View>
      <View style={styles.optionText}><Text style={styles.optionTitle}>{title}</Text><Text style={styles.optionSubtitle}>{subtitle}</Text></View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { paddingTop: spacing.xl, gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  headerSpacer: { width: 44 },
  title: { ...typography.display, color: colors.text },
  hero: { alignItems: 'center', paddingTop: spacing.xl, paddingBottom: spacing.md },
  heroIcon: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  heroTitle: { ...typography.title, color: colors.text, textAlign: 'center', marginTop: spacing.lg },
  heroBody: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs, maxWidth: 420 },
  sectionLabel: { ...typography.label, color: colors.textSecondary, textTransform: 'uppercase' },
  options: { overflow: 'hidden', borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surface },
  option: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  optionLast: { borderBottomWidth: 0 },
  optionSelected: { backgroundColor: colors.primarySoft },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  optionText: { flex: 1 },
  optionTitle: { ...typography.subtitle, color: colors.text },
  optionSubtitle: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xxs },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface },
  noteText: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  activeCard: { gap: spacing.sm, padding: spacing.lg, borderWidth: 1, borderColor: colors.primary, borderRadius: radius.lg, backgroundColor: colors.surface },
  activeHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  activeLabel: { ...typography.title, color: colors.text },
  activeHint: { ...typography.body, color: colors.textSecondary },
  error: { ...typography.caption, color: colors.danger, textAlign: 'center' },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, backgroundColor: colors.overlay },
  modalCard: { width: '100%', maxWidth: 420, alignItems: 'center', gap: spacing.sm, padding: spacing.xl, borderRadius: radius.xl, backgroundColor: colors.surface },
  modalIcon: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  modalTitle: { ...typography.title, color: colors.text, textAlign: 'center' },
  modalBody: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  modalActions: { width: '100%', flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  modalButton: { flex: 1 },
  pressed: { opacity: 0.76 },
  loading: { gap: spacing.lg, alignItems: 'center', marginTop: spacing.xxl },
  rounded: { borderRadius: radius.pill },
  heroSkeleton: { borderRadius: 48 },
  center: { alignItems: 'center', justifyContent: 'center' },
});
