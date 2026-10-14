import { useEffect, useState } from 'react';
import { Redirect, useRouter, type Href } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar, ErrorState, LoadingSkeleton, Screen } from '@/components';
import { useAuth, useMemberSession } from '@/hooks';
import { getFamilyRoster, type FamilyRoster } from '@/services';
import { playSound } from '@/services/sound';
import { colors, normalizeAvatarKey, radius, spacing, typography } from '@/theme';

export default function ManageMemberPinsScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { activeMember } = useMemberSession();
  const [roster, setRoster] = useState<FamilyRoster | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setRoster(await getFamilyRoster());
    } catch {
      setError('No pudimos cargar los integrantes. Revisa tu conexión e inténtalo nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  if (!session) return <Redirect href="/welcome" />;
  if (!activeMember) return <Redirect href="/member-select" />;

  if (loading && !roster) {
    return <Screen><View style={styles.header}><LoadingSkeleton width={40} height={40} style={styles.rounded} /><LoadingSkeleton width={210} height={34} /><View style={styles.headerSpacer} /></View><View style={styles.loading}><LoadingSkeleton height={76} /><LoadingSkeleton height={76} /></View></Screen>;
  }

  if (error || !roster) {
    return <Screen scroll={false} contentStyle={styles.center}><ErrorState message={error ?? 'No pudimos cargar esta sección.'} onRetry={() => void load()} /></Screen>;
  }

  if (!roster.isFamilyAdmin) return <Redirect href="/settings" />;

  return (
    <Screen contentStyle={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Volver" onPress={() => { void playSound('buttonPop'); router.back(); }} hitSlop={12} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={30} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>PIN de integrantes</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.notice}>
        <MaterialCommunityIcons name="shield-lock-outline" size={26} color={colors.primary} />
        <View style={styles.noticeCopy}>
          <Text style={styles.noticeTitle}>Los PIN nunca se pueden ver</Text>
          <Text style={styles.noticeText}>Tú autorizas el cambio y cada integrante crea su PIN en privado. Nunca tendrás que escribirlo ni verlo.</Text>
        </View>
      </View>

      <Text style={styles.sectionLabel}>Selecciona un integrante</Text>
      <View style={styles.list}>
        {roster.members.map((member, index) => (
          <Pressable
            accessibilityRole="button"
            key={member.id}
            onPress={() => { void playSound('buttonPop'); router.push(`/reset-member-pin?familyId=${encodeURIComponent(roster.familyId)}&memberId=${encodeURIComponent(member.id)}&member=${encodeURIComponent(member.name)}&tone=${encodeURIComponent(member.avatar_key)}` as Href); }}
            style={({ pressed }) => [styles.row, index === roster.members.length - 1 && styles.lastRow, pressed && styles.pressed]}
          >
            <Avatar initial={member.name.charAt(0).toUpperCase()} size="md" tone={normalizeAvatarKey(member.avatar_key)} />
            <View style={styles.rowContent}><Text style={styles.memberName}>{member.name}</Text><Text style={styles.memberHint}>Autorizar cambio de PIN</Text></View>
            <MaterialCommunityIcons name="chevron-right" size={30} color={colors.textSecondary} />
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingTop: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  headerSpacer: { width: 44 },
  title: { ...typography.title, color: colors.text, textAlign: 'center' },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.xl, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.primarySoft },
  noticeCopy: { flex: 1 },
  noticeTitle: { ...typography.label, color: colors.text },
  noticeText: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xxs },
  sectionLabel: { ...typography.label, color: colors.textSecondary, textTransform: 'uppercase', marginTop: spacing.xl, marginBottom: spacing.xs },
  list: { overflow: 'hidden', borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surface },
  row: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  lastRow: { borderBottomWidth: 0 },
  rowContent: { flex: 1 },
  memberName: { ...typography.subtitle, color: colors.text },
  memberHint: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xxs },
  pressed: { backgroundColor: colors.primarySoft },
  loading: { gap: 1, marginTop: spacing.xl },
  rounded: { borderRadius: radius.pill },
  center: { alignItems: 'center', justifyContent: 'center' },
});
