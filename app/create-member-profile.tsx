import { useState } from 'react';
import { Redirect, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar, Button, NumericInput, Screen, TextInput } from '@/components';
import { useAuth, useMemberSession } from '@/hooks';
import { createMemberProfile, rememberMember } from '@/services';
import {
  colors,
  imageAvatarKeys,
  radius,
  spacing,
  typography,
  type AvatarKey,
} from '@/theme';

function messageForCreateError(error: unknown) {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes('family_not_configured')) return 'Primero únete a una familia con código.';
    if (message.includes('pin_must')) return 'El PIN debe tener 4 números.';
  }
  return 'No pudimos crear tu perfil. Revisa tu conexión e inténtalo nuevamente.';
}

export default function CreateMemberProfileScreen() {
  const router = useRouter();
  const { session, loading } = useAuth();
  const { refresh } = useMemberSession();
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [pinConfirmation, setPinConfirmation] = useState('');
  const [weeklyGoal, setWeeklyGoal] = useState('100');
  const [avatarKey, setAvatarKey] = useState<AvatarKey>('console');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!loading && !session) return <Redirect href="/welcome" />;

  const submit = async () => {
    setError(null);
    if (name.trim().length < 2) return setError('Escribe tu nombre.');
    if (!/^\d{4}$/.test(pin)) return setError('El PIN debe tener 4 números.');
    if (pin !== pinConfirmation) return setError('Los PIN no coinciden.');
    const goal = Number(weeklyGoal);
    if (!Number.isInteger(goal) || goal < 1 || goal > 9999) {
      return setError('La meta debe estar entre 1 y 9999 puntos.');
    }

    setSubmitting(true);
    try {
      const result = await createMemberProfile({ name, pin, weeklyGoal: goal, avatarKey });
      await rememberMember(result.familyId, result.memberId);
      await refresh();
      router.replace('/(tabs)');
    } catch (nextError) {
      setError(messageForCreateError(nextError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <Screen contentStyle={styles.screen}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/member-select')} hitSlop={12}>
          <Text style={styles.back}>‹ Volver</Text>
        </Pressable>
        <Text style={styles.step}>NUEVO PERFIL</Text>
        <Text style={styles.title}>Crea tu perfil</Text>
        <Text style={styles.subtitle}>Este será tu espacio para sumar puntos con tu propio PIN.</Text>

        <View style={styles.form}>
          <TextInput label="Nombre" placeholder="Ej. Daniel" value={name} onChangeText={setName} />

          <View style={styles.avatarField}>
            <Text style={styles.label}>Avatar</Text>
            <View style={styles.avatarGrid}>
              {imageAvatarKeys.map((option) => {
                const selected = avatarKey === option;
                return (
                  <Pressable
                    key={option}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setAvatarKey(option)}
                    style={[styles.avatarOption, selected && styles.avatarOptionSelected]}
                  >
                    <Avatar initial={(name.trim().charAt(0) || '?').toUpperCase()} size="lg" tone={option} />
                    {selected ? (
                      <View style={styles.check}>
                        <MaterialCommunityIcons name="check" size={16} color={colors.surface} />
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>

          <TextInput keyboardType="number-pad" inputMode="numeric" label="PIN de 4 números" maxLength={4} secureTextEntry placeholder="••••" value={pin} onChangeText={(value) => setPin(value.replace(/\D/g, ''))} />
          <TextInput keyboardType="number-pad" inputMode="numeric" label="Repite el PIN" maxLength={4} secureTextEntry placeholder="••••" value={pinConfirmation} onChangeText={(value) => setPinConfirmation(value.replace(/\D/g, ''))} />
          <NumericInput label="Meta semanal" maxLength={4} placeholder="100" value={weeklyGoal} onChangeText={(value) => setWeeklyGoal(value.replace(/\D/g, ''))} />
          {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
          <Button label="Crear mi perfil" loading={submitting} onPress={() => void submit()} />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { paddingTop: spacing.md },
  back: { ...typography.bodyMedium, color: colors.primary, marginBottom: 40 },
  step: { ...typography.label, color: colors.primary },
  title: { ...typography.display, color: colors.text, marginTop: spacing.sm },
  subtitle: { ...typography.body, color: colors.textSecondary, fontSize: 15, lineHeight: 22, marginTop: spacing.sm },
  form: { gap: spacing.md, marginTop: spacing.xxl },
  avatarField: { gap: spacing.xs },
  label: { ...typography.label, color: colors.text },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  avatarOption: { width: 94, height: 94, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  avatarOptionSelected: { borderWidth: 2, borderColor: colors.primary, backgroundColor: colors.primarySoft },
  check: { position: 'absolute', right: spacing.xs, top: spacing.xs, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  error: { ...typography.caption, color: colors.danger, marginTop: -spacing.xs },
});
