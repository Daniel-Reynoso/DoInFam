import { useEffect, useRef, useState } from 'react';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar, PinInput, Screen } from '@/components';
import { useAuth, useMemberSession, useReducedMotion } from '@/hooks';
import { rememberMember } from '@/services';
import { playSound } from '@/services/sound';
import { colors, fontFamilies, normalizeAvatarKey, typography } from '@/theme';
import type { FamilyMember } from '@/types';

const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'backspace'] as const;

export default function PinScreen() {
  const router = useRouter();
  const { familyId, memberId, member = 'Gabriel', tone = 'coral' } = useLocalSearchParams<{ familyId?: string; memberId?: string; member?: string; tone?: FamilyMember['avatarTone'] }>();
  const { session } = useAuth();
  const { selectMember, clearMember } = useMemberSession();
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryAfter, setRetryAfter] = useState(0);
  const reducedMotion = useReducedMotion();
  const entrance = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reducedMotion) {
      entrance.setValue(1);
      return;
    }

    Animated.timing(entrance, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [entrance, reducedMotion]);

  useEffect(() => {
    if (retryAfter <= 0) return;
    const timer = setInterval(() => {
      setRetryAfter((current) => Math.max(0, current - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [retryAfter]);

  useEffect(() => {
    if (retryAfter === 0 && error?.startsWith('Demasiados intentos')) setError(null);
  }, [error, retryAfter]);

  useEffect(() => {
    if (pin.length !== 4 || submitting || retryAfter > 0) return;

    if (!session || !memberId) return;

    let mounted = true;
    setSubmitting(true);
    setError(null);
    selectMember(memberId, pin)
      .then(async (result) => {
        if (!mounted) return;
        if (result.ok) {
          if (familyId) await rememberMember(familyId, memberId);
          if (mounted) router.replace('/(tabs)');
          return;
        }

        setPin('');
        void playSound('pinError');
        if (result.code === 'PIN_LOCKED') {
          setRetryAfter(result.retryAfterSeconds);
          setError(`Demasiados intentos. Intenta nuevamente en ${result.retryAfterSeconds} s.`);
        } else {
          const attempts = result.attemptsRemaining;
          setError(attempts === 1 ? 'PIN incorrecto. Queda 1 intento.' : `PIN incorrecto. Quedan ${attempts} intentos.`);
        }
      })
      .catch(() => {
        if (!mounted) return;
        setPin('');
        void playSound('pinError');
        setError('No pudimos validar el PIN. Revisa tu conexión.');
      })
      .finally(() => {
        if (mounted) setSubmitting(false);
      });

    return () => {
      mounted = false;
    };
  }, [memberId, pin, retryAfter, router, selectMember, session]);

  const handleKey = (key: (typeof keys)[number]) => {
    if (key === '' || submitting || retryAfter > 0) return;
    void playSound('buttonPop');
    setError(null);
    if (key === 'backspace') {
      setPin((current) => current.slice(0, -1));
      return;
    }
    setPin((current) => `${current}${key}`.slice(0, 4));
  };

  const handleChangeMember = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await clearMember();
      router.replace('/member-select');
    } catch {
      setError('No pudimos cambiar de integrante. Inténtalo nuevamente.');
      setSubmitting(false);
    }
  };

  if (!session || !memberId) return <Redirect href="/welcome" />;

  return (
    <Screen scroll={false} contentStyle={styles.screen}>
      <Animated.View style={[styles.content, { opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}>
        <Avatar initial={member.charAt(0)} size="lg" tone={normalizeAvatarKey(tone)} />
        <Text style={styles.title}>Hola, {member}</Text>
        <Text style={styles.subtitle}>Introduce tu PIN</Text>
        <View style={styles.pin}>
          <PinInput showKeyboard={false} value={pin} onChangeText={setPin} />
          {submitting ? <ActivityIndicator style={styles.pinStatus} color={colors.primary} size="small" /> : null}
          {error ? <Text accessibilityLiveRegion="polite" style={styles.pinError}>{retryAfter > 0 ? `Espera ${retryAfter} s para intentarlo otra vez.` : error}</Text> : null}
        </View>
        <View style={styles.keypad}>
          {keys.map((key, index) => key === '' ? <View key={`empty-${index}`} style={styles.keySpace} /> : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={key === 'backspace' ? 'Borrar último número' : `Número ${key}`}
              disabled={submitting || retryAfter > 0}
              key={key}
              onPress={() => handleKey(key)}
              style={({ pressed }) => [styles.key, (submitting || retryAfter > 0) && styles.keyDisabled, pressed && styles.keyPressed]}
            >
              {key === 'backspace'
                ? <MaterialCommunityIcons name="backspace-outline" size={24} color={colors.textSecondary} />
                : <Text style={styles.keyText}>{key}</Text>}
            </Pressable>
          ))}
        </View>
        <Pressable accessibilityRole="button" disabled={submitting} onPress={() => void handleChangeMember()} hitSlop={12} style={({ pressed }) => pressed && styles.linkPressed}>
          <Text style={styles.link}>Cambiar integrante</Text>
        </Pressable>
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingTop: 0 },
  content: { alignItems: 'center', paddingTop: 106 },
  title: { ...typography.title, color: colors.text, fontSize: 23, lineHeight: 29, marginTop: 19 },
  subtitle: { ...typography.body, color: colors.textSecondary, fontSize: 15, lineHeight: 21, marginTop: 8 },
  pin: { width: 280, alignItems: 'center', marginTop: 30, marginBottom: 55, position: 'relative' },
  pinStatus: { position: 'absolute', top: 27, alignSelf: 'center' },
  pinError: { position: 'absolute', top: 25, width: 280, textAlign: 'center', ...typography.caption, color: colors.danger },
  keypad: { width: 279, flexDirection: 'row', flexWrap: 'wrap', columnGap: 9, rowGap: 9 },
  key: { width: 87, height: 48, borderRadius: 24, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  keySpace: { width: 87, height: 48 },
  keyPressed: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  keyDisabled: { opacity: 0.55 },
  keyText: { fontFamily: fontFamilies.semibold, fontSize: 25, lineHeight: 31, color: colors.text },
  link: { marginTop: 47, fontFamily: fontFamilies.semibold, fontSize: 14, lineHeight: 20, color: colors.primary, textDecorationLine: 'underline' },
  linkPressed: { opacity: 0.65 },
});
