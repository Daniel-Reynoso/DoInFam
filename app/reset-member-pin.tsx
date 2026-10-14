import { useEffect, useState } from 'react';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar, Button, ErrorState, LoadingSkeleton, Screen, TextInput } from '@/components';
import { useAuth, useMemberSession } from '@/hooks';
import { getPinRecoveryAccess, verifyAdminAndAuthorizeMemberPinReset, type PinRecoveryAccess } from '@/services';
import { playSound } from '@/services/sound';
import { colors, normalizeAvatarKey, radius, spacing, typography } from '@/theme';

type FormErrors = Partial<Record<'password', string>>;

function resetErrorMessage(error: unknown) {
  if (error instanceof Error && error.message === 'ADMIN_PASSWORD_INVALID') return 'La contraseña de la cuenta responsable no es correcta.';
  if (error instanceof Error && error.message.includes('RECENT_ADMIN_AUTH_REQUIRED')) return 'No pudimos confirmar la identidad del responsable. Inténtalo nuevamente.';
  if (error instanceof Error && error.message.includes('FAMILY_ADMIN_REQUIRED')) return 'Solo el responsable de la familia puede cambiar este PIN.';
  if (error instanceof Error && error.message.includes('MEMBER_NOT_FOUND')) return 'Este integrante ya no está disponible.';
  return 'No pudimos autorizar el cambio de PIN. Revisa tu conexión e inténtalo nuevamente.';
}

export default function ResetMemberPinScreen() {
  const router = useRouter();
  const { memberId, member = 'Integrante', tone = 'teal', familyId } = useLocalSearchParams<{ memberId?: string; member?: string; tone?: string; familyId?: string; recovery?: string }>();
  const { session } = useAuth();
  const { clearMember } = useMemberSession();
  const [access, setAccess] = useState<PinRecoveryAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setAccess(await getPinRecoveryAccess());
    } catch {
      setLoadError('No pudimos comprobar quién administra la familia.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  if (!session || !memberId) return <Redirect href="/member-select" />;

  const submit = async () => {
    const nextErrors: FormErrors = {};
    if (!password) nextErrors.password = 'Introduce la contraseña de la cuenta responsable.';
    setErrors(nextErrors);
    setFormError(null);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      await verifyAdminAndAuthorizeMemberPinReset(memberId, password);
      setComplete(true);
    } catch (error) {
      setFormError(resetErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handOffDevice = async () => {
    setSubmitting(true);
    setFormError(null);
    try {
      await clearMember();
      router.replace({
        pathname: '/pin',
        params: { familyId, memberId, member, tone },
      });
    } catch {
      setFormError('No pudimos preparar el dispositivo. Inténtalo nuevamente.');
      setSubmitting(false);
    }
  };

  if (loading && !access) {
    return <Screen><View style={styles.header}><LoadingSkeleton width={40} height={40} style={styles.rounded} /><LoadingSkeleton width={170} height={34} /><View style={styles.headerSpacer} /></View><View style={styles.loading}><LoadingSkeleton width={88} height={88} style={styles.avatarSkeleton} /><LoadingSkeleton height={160} /></View></Screen>;
  }

  if (loadError || !access) {
    return <Screen scroll={false} contentStyle={styles.center}><ErrorState message={loadError ?? 'No pudimos cargar la recuperación.'} onRetry={() => void load()} /></Screen>;
  }

  if (!access.canResetPins) {
    return (
      <Screen scroll={false} contentStyle={styles.center}>
        <View style={styles.helpIcon}><MaterialCommunityIcons name="account-heart-outline" size={42} color={colors.primary} /></View>
        <Text style={styles.helpTitle}>Pide ayuda al responsable</Text>
        <Text style={styles.helpBody}>Por seguridad, el PIN de {member} solo puede reemplazarse desde el dispositivo de la persona que creó la familia. El PIN actual nunca puede verse.</Text>
        <Button label="Elegir otro integrante" onPress={() => router.replace('/member-select')} style={styles.helpButton} />
      </Screen>
    );
  }

  if (complete) {
    return (
      <Screen scroll={false} contentStyle={styles.center}>
        <View style={styles.successIcon}><MaterialCommunityIcons name="check" size={42} color={colors.surface} /></View>
        <Text style={styles.helpTitle}>Todo listo para {member}</Text>
        <Text style={styles.helpBody}>Entrégale el dispositivo. En la siguiente pantalla creará su PIN en privado y tú no tendrás que verlo.</Text>
        {formError ? <Text accessibilityLiveRegion="polite" style={styles.error}>{formError}</Text> : null}
        <Button label="Continuar y entregar dispositivo" loading={submitting} onPress={() => void handOffDevice()} style={styles.helpButton} />
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <Screen contentStyle={styles.screen}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Volver" onPress={() => { void playSound('buttonPop'); router.back(); }} hitSlop={12} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={30} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>Autorizar cambio</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.identity}>
          <Avatar initial={member.charAt(0).toUpperCase()} size="lg" tone={normalizeAvatarKey(tone)} />
          <Text style={styles.memberName}>{member}</Text>
          <Text style={styles.memberCopy}>Tú autorizas el cambio. {member} creará su PIN después.</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.securityNote}>
            <MaterialCommunityIcons name="email-lock" size={24} color={colors.primary} />
            <Text style={styles.securityText}>Confirma la contraseña de <Text style={styles.securityStrong}>{access.email}</Text>. Esta autorización durará 30 minutos.</Text>
          </View>
          <TextInput
            autoComplete="current-password"
            label="Contraseña de la cuenta responsable"
            secureTextEntry
            value={password}
            onChangeText={(value) => { setPassword(value); setErrors((current) => ({ ...current, password: undefined })); }}
            error={errors.password}
          />
          {formError ? <Text accessibilityLiveRegion="polite" style={styles.error}>{formError}</Text> : null}
          <Button label="Autorizar a {member}" loading={submitting} onPress={() => void submit()} />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { paddingTop: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  headerSpacer: { width: 44 },
  title: { ...typography.title, color: colors.text, textAlign: 'center' },
  identity: { alignItems: 'center', marginTop: spacing.xl },
  memberName: { ...typography.title, color: colors.text, marginTop: spacing.sm },
  memberCopy: { ...typography.caption, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xxs },
  form: { gap: spacing.md, marginTop: spacing.xl },
  securityNote: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.primarySoft },
  securityText: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  securityStrong: { color: colors.text, fontFamily: typography.label.fontFamily },
  error: { ...typography.caption, color: colors.danger, textAlign: 'center' },
  center: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  helpIcon: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  successIcon: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.success },
  helpTitle: { ...typography.title, color: colors.text, textAlign: 'center', marginTop: spacing.lg },
  helpBody: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs, maxWidth: 420 },
  helpButton: { width: '100%', maxWidth: 420, marginTop: spacing.xl },
  loading: { alignItems: 'center', gap: spacing.lg, marginTop: spacing.xl },
  rounded: { borderRadius: radius.pill },
  avatarSkeleton: { borderRadius: 44 },
});
