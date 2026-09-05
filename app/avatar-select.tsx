import { useState } from 'react';
import { Redirect, useRouter, type Href } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar, Button, Screen } from '@/components';
import { useAuth, useMemberSession } from '@/hooks';
import { updateActiveMemberProfile } from '@/services';
import { colorAvatarKeys, colors, imageAvatarKeys, normalizeAvatarKey, radius, spacing, typography, type AvatarKey } from '@/theme';

const settingsHref = '/settings' as Href;

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message.includes('MEMBER_SESSION')) return 'Tu sesión de integrante venció. Vuelve a introducir tu PIN.';
  return 'No pudimos guardar tu avatar. Revisa tu conexión e inténtalo nuevamente.';
}

export default function AvatarSelectScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { activeMember, refresh } = useMemberSession();
  const [selected, setSelected] = useState<AvatarKey>(normalizeAvatarKey(activeMember?.avatarKey));
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (!session) return <Redirect href="/welcome" />;
  if (!activeMember) return <Redirect href="/member-select" />;

  const save = async () => {
    setSubmitting(true);
    setFormError(null);
    try {
      await updateActiveMemberProfile(activeMember.name, selected);
      await refresh();
      router.replace(settingsHref);
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen contentStyle={styles.screen}>
      <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace(settingsHref)} hitSlop={12}>
        <Text style={styles.back}>‹ Volver</Text>
      </Pressable>
      <Text style={styles.title}>Cambiar avatar</Text>
      <Text style={styles.subtitle}>Elige un estilo para tu perfil. Puedes usar un avatar ilustrado o mantener uno simple con color.</Text>
      <Text style={styles.sectionTitle}>Avatares</Text>
      <View style={styles.grid}>
        {imageAvatarKeys.map((option) => {
          const isSelected = selected === option;
          return (
            <Pressable key={option} accessibilityRole="button" accessibilityState={{ selected: isSelected }} onPress={() => setSelected(option)} style={[styles.imageOption, isSelected && styles.avatarOptionSelected]}>
              <Avatar initial={activeMember.name.charAt(0).toUpperCase()} size="lg" tone={option} />
              {isSelected ? <View style={styles.check}><MaterialCommunityIcons name="check" size={16} color={colors.surface} /></View> : null}
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.sectionTitle}>Colores</Text>
      <View style={styles.colorGrid}>
        {colorAvatarKeys.map((option) => {
          const isSelected = selected === option;
          return (
            <Pressable key={option} accessibilityRole="button" accessibilityState={{ selected: isSelected }} onPress={() => setSelected(option)} style={[styles.avatarOption, isSelected && styles.avatarOptionSelected]}>
              <Avatar initial={activeMember.name.charAt(0).toUpperCase()} size="lg" tone={option} />
              {isSelected ? <View style={styles.check}><MaterialCommunityIcons name="check" size={16} color={colors.surface} /></View> : null}
            </Pressable>
          );
        })}
      </View>
      {formError ? <Text accessibilityLiveRegion="polite" style={styles.error}>{formError}</Text> : null}
      <Button label="Guardar avatar" loading={submitting} onPress={() => void save()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingTop: spacing.md },
  back: { ...typography.bodyMedium, color: colors.primary, marginBottom: spacing.xxl },
  title: { ...typography.display, color: colors.text },
  subtitle: { ...typography.body, color: colors.textSecondary, fontSize: 15, lineHeight: 22, marginTop: spacing.xs },
  sectionTitle: { ...typography.label, color: colors.textSecondary, textTransform: 'uppercase', marginTop: spacing.xl, marginBottom: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.xxl },
  avatarOption: { width: 94, height: 94, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  imageOption: { width: 94, height: 94, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  avatarOptionSelected: { borderWidth: 2, borderColor: colors.primary, backgroundColor: colors.primarySoft },
  check: { position: 'absolute', right: spacing.xs, top: spacing.xs, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  error: { ...typography.caption, color: colors.danger, marginBottom: spacing.md },
});
