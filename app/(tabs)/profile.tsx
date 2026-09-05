import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar, EmptyState, ErrorState, IconButton, LoadingSkeleton, ProgressBar, Screen, SectionHeader } from '@/components';
import { useMemberSession, useReducedMotion } from '@/hooks';
import { deleteTaskCompletion, getProfileSummary, type ProfileActivity, type ProfileSummary } from '@/services';
import { colors, normalizeAvatarKey, radius, spacing, typography } from '@/theme';

const settingsHref = '/settings' as Href;

const limaDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' });
const limaTime = new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', hour: 'numeric', minute: '2-digit', hour12: false });
const limaWeekday = new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', weekday: 'long' });

function activityTimeLabel(completedAt: string) {
  const completed = new Date(completedAt);
  const today = new Date();
  const completedKey = limaDate.format(completed);
  const todayKey = limaDate.format(today);
  const yesterdayKey = limaDate.format(new Date(today.getTime() - 86_400_000));
  if (completedKey === todayKey) return `Hoy ${limaTime.format(completed)}`;
  if (completedKey === yesterdayKey) return 'Ayer';
  const weekday = limaWeekday.format(completed);
  return weekday.charAt(0).toUpperCase() + weekday.slice(1);
}

export default function ProfileScreen() {
  const router = useRouter();
  const { activeMember } = useMemberSession();
  const [summary, setSummary] = useState<ProfileSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [correctionError, setCorrectionError] = useState<string | null>(null);
  const [deletingActivityId, setDeletingActivityId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeMember) {
      router.replace('/member-select');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setSummary(await getProfileSummary(activeMember.id));
    } catch (nextError) {
      if (nextError instanceof Error && nextError.message.includes('MEMBER_SESSION')) {
        router.replace('/member-select');
        return;
      }
      setError('No pudimos cargar tu perfil. Revisa tu conexión e inténtalo nuevamente.');
    } finally {
      setLoading(false);
    }
  }, [activeMember, router]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const handleDeleteActivity = async (activityId: string) => {
    if (deletingActivityId) return;
    setDeletingActivityId(activityId);
    setCorrectionError(null);
    try {
      await deleteTaskCompletion(activityId);
      await new Promise((resolve) => setTimeout(resolve, 180));
      await load();
    } catch (nextError) {
      if (nextError instanceof Error && nextError.message.includes('MEMBER_SESSION')) {
        router.replace('/member-select');
        return;
      }
      setCorrectionError('No pudimos corregir esa tarea. Solo se pueden corregir tareas de esta semana.');
    } finally {
      setDeletingActivityId(null);
    }
  };

  if (loading && !summary) {
    return <Screen><LoadingSkeleton width={100} height={28} /><View style={styles.loadingIdentity}><LoadingSkeleton width={68} height={68} style={styles.rounded} /><LoadingSkeleton width={120} height={18} /></View><View style={styles.loadingStats}><LoadingSkeleton height={82} /><LoadingSkeleton height={82} /><LoadingSkeleton height={82} /></View></Screen>;
  }

  if (error || !summary || !activeMember) {
    return <Screen scroll={false} contentStyle={styles.centerState}><ErrorState message={error ?? 'No pudimos cargar Perfil.'} onRetry={() => void load()} /></Screen>;
  }

  const tone = normalizeAvatarKey(activeMember.avatarKey);
  return (
    <Screen>
      <View style={styles.header}><Text style={styles.title}>Perfil</Text><IconButton icon="cog-outline" label="Configuración" onPress={() => router.push(settingsHref)} /></View>
      <View style={styles.identity}><Avatar initial={activeMember.name.charAt(0).toUpperCase()} size="lg" tone={tone} /><Text style={styles.name}>{activeMember.name}</Text><Text style={styles.family}>{summary.familyName}</Text></View>
      <View style={styles.stats}>
        <Stat icon="swap-vertical" value={`#${summary.rank}`} label="Semana" />
        <Stat icon="fire" value={`${summary.streak} sem`} label="Racha" />
        <Stat icon="check-circle-outline" value={`${summary.completionPercent}%`} label="Completado" />
      </View>
      <View style={styles.progress}><ProgressBar value={summary.goal > 0 ? summary.points / summary.goal : 0} /><Text style={styles.progressText}><Text style={styles.progressStrong}>{summary.points} / {summary.goal} pts</Text> acumulados</Text></View>
      <Pressable onPress={() => router.push('/weekly-goal')} hitSlop={12}>
        <Text style={styles.goalLink}>Cambiar meta semanal</Text>
      </Pressable>
      <View style={styles.section}>
        <SectionHeader title="Esta semana" />
        {correctionError ? <Text accessibilityLiveRegion="polite" style={styles.correctionError}>{correctionError}</Text> : null}
        {summary.activities.length > 0 ? <View style={styles.list}>{summary.activities.map((activity) => <ActivityRow key={activity.id} activity={activity} isRemoving={deletingActivityId === activity.id} onDelete={() => void handleDeleteActivity(activity.id)} />)}</View> : <View style={styles.empty}><EmptyState title="Aún no hay actividad" message="Las tareas que completes esta semana aparecerán aquí." /></View>}
      </View>
    </Screen>
  );
}

function Stat({ icon, value, label }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; value: string; label: string }) {
  return <View style={styles.stat}><MaterialCommunityIcons name={icon} size={16} color={colors.primary} /><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

function ActivityRow({ activity, isRemoving, onDelete }: { activity: ProfileActivity; isRemoving: boolean; onDelete: () => void }) {
  const reducedMotion = useReducedMotion();
  const progress = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reducedMotion) {
      progress.setValue(isRemoving ? 0 : 1);
      return;
    }

    Animated.timing(progress, {
      toValue: isRemoving ? 0 : 1,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [isRemoving, progress, reducedMotion]);

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [18, 0] });

  return (
    <Animated.View style={[styles.activity, { opacity: progress, transform: [{ translateX }] }]}>
      <View style={styles.activityContent}>
        <Text numberOfLines={1} style={styles.activityName}>{activity.taskName}</Text>
        <View style={styles.activityMeta}>
          <Text style={styles.activityPoints}>+{activity.points} pts</Text>
          <Text style={styles.activityTime}>{activityTimeLabel(activity.completedAt)}</Text>
        </View>
      </View>
      <Pressable accessibilityRole="button" disabled={isRemoving} hitSlop={8} onPress={onDelete} style={({ pressed }) => [styles.correctButton, pressed && styles.correctButtonPressed]}>
        <Text style={styles.correctButtonText}>{isRemoving ? 'Corrigiendo…' : 'Corregir'}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...typography.title, color: colors.text },
  identity: { alignItems: 'center', marginTop: spacing.lg },
  name: { ...typography.subtitle, color: colors.text, marginTop: spacing.sm },
  family: { ...typography.caption, color: colors.textSecondary },
  stats: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.lg },
  stat: { flex: 1, alignItems: 'center', gap: spacing.xxs, padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface },
  statValue: { ...typography.label, color: colors.text },
  statLabel: { ...typography.metadata, color: colors.textSecondary },
  progress: { marginTop: spacing.md, gap: spacing.xs },
  progressText: { ...typography.caption, color: colors.textSecondary },
  progressStrong: { color: colors.primary, fontFamily: typography.label.fontFamily },
  goalLink: { ...typography.label, color: colors.primary, textAlign: 'center', marginTop: spacing.sm },
  section: { marginTop: spacing.xl, gap: spacing.xs },
  list: { overflow: 'hidden', borderWidth: 1, borderColor: colors.divider, borderRadius: radius.md },
  activity: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider, backgroundColor: colors.surface },
  activityContent: { flex: 1 },
  activityName: { ...typography.bodyMedium, color: colors.text },
  activityMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  activityPoints: { ...typography.metadata, color: colors.primary, marginRight: spacing.sm },
  activityTime: { ...typography.metadata, color: colors.textSecondary },
  correctionError: { ...typography.caption, color: colors.danger, textAlign: 'center' },
  correctButton: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs, borderRadius: radius.pill, backgroundColor: colors.dangerSoft },
  correctButtonPressed: { opacity: 0.76 },
  correctButtonText: { ...typography.metadata, color: colors.danger },
  empty: { overflow: 'hidden', borderWidth: 1, borderColor: colors.divider, borderRadius: radius.md, backgroundColor: colors.surface },
  centerState: { alignItems: 'center', justifyContent: 'center' },
  loadingIdentity: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg },
  loadingStats: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.lg },
  rounded: { borderRadius: 34 },
});
