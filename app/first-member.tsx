import { useState } from 'react';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar, Button, NumericInput, Screen, TextInput } from '@/components';
import { useAuth, useMemberSession } from '@/hooks';
import { createFamily, rememberMember } from '@/services';
import { colors, imageAvatarKeys, radius, spacing, typography, type AvatarKey } from '@/theme';

function messageForCreateError(error: unknown) {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes('already') || message.includes('ya tiene')) return 'Esta cuenta ya tiene una familia configurada.';
  }
  return 'No pudimos crear la familia. Revisa tu conexión e inténtalo nuevamente.';
}

export default function FirstMemberScreen() {
  const router = useRouter();
  const { familyName = '' } = useLocalSearchParams<{ familyName?: string }>();
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
  if (!familyName.trim()) return <Redirect href="/create-family" />;

  const submit = async () => {
    setError(null);
    if (name.trim().length < 2) return setError('Escribe el nombre del primer integrante.');
    if (!/^\d{4}$/.test(pin)) return setError('El PIN debe tener 4 números.');
    if (pin !== pinConfirmation) return setError('Los PIN no coinciden.');
    const goal = Number(weeklyGoal);
    if (!Number.isInteger(goal) || goal < 1 || goal > 9999) return setError('La meta debe estar entre 1 y 9999 puntos.');
    if (!session) return;

    setSubmitting(true);
    try {
      const result = await createFamily({ familyName, firstMemberName: name, pin, weeklyGoal: goal, avatarKey });
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
        <Pressable onPress={() => router.back()} hitSlop={12}><Text style={styles.back}>‹ Volver</Text></Pressable>
        <Text style={styles.step}>PASO 2 DE 2</Text>
        <Text style={styles.title}>Crea el primer integrante</Text>
        <Text style={styles.subtitle}>Será la primera persona que podrá sumar puntos en {familyName}.</Text>

        <View style={styles.form}>
          <TextInput label="Nombre" placeholder="Ej. Gabriel" value={name} onChangeText={setName} />
          <View style={styles.avatarField}>
            <Text style={styles.label}>Avatar</Text>
            <View style={styles.avatars}>
              {imageAvatarKeys.map((tone) => (
                <Pressable key={tone} accessibilityRole="radio" accessibilityState={{ checked: avatarKey === tone }} onPress={() => setAvatarKey(tone)} style={[styles.avatarChoice, avatarKey === tone && styles.avatarChoiceSelected]}>
                  <Avatar initial={(name.trim().charAt(0) || '?').toUpperCase()} size="lg" tone={tone} />
                </Pressable>
              ))}
            </View>
          </View>
          <TextInput keyboardType="number-pad" inputMode="numeric" label="PIN de 4 números" maxLength={4} secureTextEntry placeholder="••••" value={pin} onChangeText={(value) => setPin(value.replace(/\D/g, ''))} />
          <TextInput keyboardType="number-pad" inputMode="numeric" label="Repite el PIN" maxLength={4} secureTextEntry placeholder="••••" value={pinConfirmation} onChangeText={(value) => setPinConfirmation(value.replace(/\D/g, ''))} />
          <NumericInput label="Meta semanal" maxLength={4} placeholder="100" value={weeklyGoal} onChangeText={(value) => setWeeklyGoal(value.replace(/\D/g, ''))} />
          {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
          <Button label="Crear familia" loading={submitting} onPress={() => void submit()} />
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
  avatars: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  avatarChoice: { width: 94, height: 94, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  avatarChoiceSelected: { borderColor: colors.primary },
  error: { ...typography.caption, color: colors.danger, marginTop: -spacing.xs },
});
