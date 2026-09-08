import { useCallback, useState } from 'react';
import { Redirect, useFocusEffect, useRouter, type Href } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Avatar, ErrorState, LoadingSkeleton, Screen } from '@/components';
import { useAuth, useMemberSession } from '@/hooks';
import { getFamilyRoster, getRestMode } from '@/services';
import { getSoundEnabled, playSound, setSoundEnabled } from '@/services/sound';
import { colors, normalizeAvatarKey, radius, spacing, typography } from '@/theme';

const editProfileNameHref = '/edit-profile-name' as Href;
const avatarSelectHref = '/avatar-select' as Href;
const editFamilyNameHref = '/edit-family-name' as Href;
const restModeHref = '/rest-mode' as Href;

export default function SettingsScreen() {
  const router = useRouter();
  const { session, signOut } = useAuth();
  const { activeMember, clearMember } = useMemberSession();
  const [familyName, setFamilyName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [soundEnabled, setLocalSoundEnabled] = useState(true);
  const [restActive, setRestActive] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [roster, enabled, restMode] = await Promise.all([getFamilyRoster(), getSoundEnabled(), getRestMode()]);
      setFamilyName(roster.familyName);
      setInviteCode(roster.inviteCode);
      setLocalSoundEnabled(enabled);
      setRestActive(restMode.active);
    } catch {
      setError('No pudimos cargar los ajustes. Revisa tu conexión e inténtalo nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { void load(); }, []));

  if (!session) return <Redirect href="/welcome" />;
  if (!activeMember) return <Redirect href="/member-select" />;

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await clearMember();
      await signOut();
      router.replace('/welcome');
    } catch {
      setError('No pudimos cerrar sesión. Inténtalo nuevamente.');
      setSigningOut(false);
    }
  };

  const handleSoundChange = async (enabled: boolean) => {
    setLocalSoundEnabled(enabled);
    await setSoundEnabled(enabled);
    if (enabled) void playSound('buttonPop');
  };

  if (loading) {
    return (
      <Screen>
        <View style={styles.header}><LoadingSkeleton width={40} height={40} style={styles.rounded} /><LoadingSkeleton width={120} height={36} /></View>
        <View style={styles.loadingIdentity}><LoadingSkeleton width={112} height={112} style={styles.avatarSkeleton} /><LoadingSkeleton width={140} height={30} /><LoadingSkeleton width={120} height={20} /></View>
        <View style={styles.listSkeleton}><LoadingSkeleton height={70} /><LoadingSkeleton height={70} /><LoadingSkeleton height={70} /></View>
      </Screen>
    );
  }

  if (error) {
    return <Screen scroll={false} contentStyle={styles.center}><ErrorState message={error} onRetry={() => void load()} /></Screen>;
  }

  return (
    <Screen contentStyle={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Volver" onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/profile')} hitSlop={12} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={32} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Ajustes</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.identity}>
        <View style={styles.avatarRing}>
          <Avatar initial={activeMember.name.charAt(0).toUpperCase()} size="xl" tone={normalizeAvatarKey(activeMember.avatarKey)} />
        </View>
        <Text style={styles.name}>{activeMember.name}</Text>
        <Text style={styles.family}>{familyName}</Text>
      </View>

      <View style={styles.menu}>
        <SettingsRow icon="pencil" label="Editar mi nombre" onPress={() => router.push(editProfileNameHref)} />
        <SettingsRow icon="face-man-profile" label="Cambiar avatar" onPress={() => router.push(avatarSelectHref)} />
        <SettingsRow icon="home-edit-outline" label="Editar nombre de familia" onPress={() => router.push(editFamilyNameHref)} />
        <SettingsRow icon="weather-sunset" label="Modo descanso" detail={restActive ? 'Activo' : undefined} onPress={() => router.push(restModeHref)} />
        <SettingsRow icon="account-switch-outline" label="Cambiar integrante" onPress={() => router.replace('/member-select')} />
        <SettingsToggleRow icon="volume-high" label="Sonidos de la app" value={soundEnabled} onValueChange={handleSoundChange} last />
      </View>

      <View style={styles.inviteCard}>
        <Text style={styles.inviteLabel}>Código familiar</Text>
        <Text selectable style={styles.inviteCode}>{inviteCode}</Text>
        <Text style={styles.inviteHint}>Compártelo para que otra cuenta pueda unirse y crear su perfil.</Text>
      </View>

      <Pressable accessibilityRole="button" disabled={signingOut} onPress={() => void handleSignOut()} style={({ pressed }) => [styles.signOut, pressed && styles.pressed, signingOut && styles.disabled]}>
        <Text style={styles.signOutText}>{signingOut ? 'Cerrando sesión...' : 'Cerrar sesión del dispositivo'}</Text>
      </Pressable>
    </Screen>
  );
}

function SettingsRow({ icon, label, detail, onPress, last = false }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; label: string; detail?: string; onPress: () => void; last?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={() => { void playSound('buttonPop'); onPress(); }} style={({ pressed }) => [styles.row, last && styles.lastRow, pressed && styles.pressed]}>
      <MaterialCommunityIcons name={icon} size={24} color={colors.text} />
      <Text style={styles.rowLabel}>{label}</Text>
      {detail ? <Text style={styles.rowDetail}>{detail}</Text> : null}
      <MaterialCommunityIcons name="chevron-right" size={32} color={colors.textSecondary} />
    </Pressable>
  );
}

function SettingsToggleRow({ icon, label, value, onValueChange, last = false }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; label: string; value: boolean; onValueChange: (value: boolean) => void | Promise<void>; last?: boolean }) {
  return (
    <View style={[styles.row, last && styles.lastRow]}>
      <MaterialCommunityIcons name={icon} size={24} color={colors.text} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch
        accessibilityLabel={label}
        onValueChange={(nextValue) => { void onValueChange(nextValue); }}
        thumbColor={colors.surface}
        trackColor={{ false: colors.border, true: colors.primary }}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { paddingTop: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.display, color: colors.text },
  headerSpacer: { width: 44 },
  identity: { alignItems: 'center', marginTop: spacing.xxxl, marginBottom: spacing.xxxl },
  avatarRing: { width: 112, height: 112, borderRadius: 56, borderWidth: 3, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  name: { ...typography.display, color: colors.text, marginTop: spacing.lg },
  family: { ...typography.title, color: colors.textSecondary, fontFamily: typography.body.fontFamily, marginTop: spacing.xs },
  menu: { overflow: 'hidden', borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surface },
  row: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  lastRow: { borderBottomWidth: 0 },
  rowLabel: { ...typography.title, color: colors.text, flex: 1 },
  rowDetail: { ...typography.metadata, color: colors.primary },
  inviteCard: { marginTop: spacing.xl, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surface, padding: spacing.lg },
  inviteLabel: { ...typography.label, color: colors.textSecondary, textTransform: 'uppercase' },
  inviteCode: { ...typography.display, color: colors.primary, letterSpacing: 3, marginTop: spacing.sm },
  inviteHint: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  signOut: { minHeight: 52, alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surface, paddingHorizontal: spacing.md },
  signOutText: { ...typography.bodyMedium, color: colors.danger, textAlign: 'center' },
  pressed: { backgroundColor: colors.primarySoft },
  disabled: { opacity: 0.5 },
  center: { alignItems: 'center', justifyContent: 'center' },
  rounded: { borderRadius: radius.pill },
  avatarSkeleton: { borderRadius: 56 },
  loadingIdentity: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.xxxl },
  listSkeleton: { gap: 1, marginTop: spacing.xxxl },
});
