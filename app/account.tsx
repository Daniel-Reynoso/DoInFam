import { useState } from 'react';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Screen, TextInput } from '@/components';
import { useAuth } from '@/hooks';
import { colors, fontFamilies, spacing, typography } from '@/theme';

function messageForAuthError(error: unknown) {
  if (!(error instanceof Error)) return 'Ocurrió un error. Inténtalo nuevamente.';
  const message = error.message.toLowerCase();
  if (message.includes('invalid login credentials')) return 'El correo o la contraseña no son correctos.';
  if (message.includes('already registered')) return 'Este correo ya tiene una cuenta.';
  if (message.includes('email rate limit')) return 'Espera un momento antes de solicitar otro correo.';
  if (message.includes('password') && message.includes('8')) return 'La contraseña debe tener al menos 8 caracteres.';
  if (message.startsWith('ingresa') || message.startsWith('la contraseña')) return error.message;
  return 'No pudimos conectar con Supabase. Revisa tu conexión e inténtalo nuevamente.';
}

export default function AccountScreen() {
  const router = useRouter();
  const { mode = 'signup' } = useLocalSearchParams<{ mode?: 'signup' | 'signin' }>();
  const { session, signIn, signUp } = useAuth();
  const isSignUp = mode !== 'signin';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const switchMode = () => {
    setError(null);
    setConfirmationSent(false);
    setPassword('');
    setConfirmation('');
    router.replace({ pathname: '/account', params: { mode: isSignUp ? 'signin' : 'signup' } });
  };

  const submit = async () => {
    setError(null);
    if (isSignUp && password !== confirmation) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setSubmitting(true);
    try {
      if (isSignUp) {
        const result = await signUp(email, password);
        if (result.requiresEmailConfirmation) {
          setConfirmationSent(true);
        } else {
          router.replace('/family-start');
        }
      } else {
        await signIn(email, password);
        router.replace('/');
      }
    } catch (nextError) {
      setError(messageForAuthError(nextError));
    } finally {
      setSubmitting(false);
    }
  };

  if (session) return <Redirect href="/" />;

  if (confirmationSent) {
    return (
      <Screen scroll={false} contentStyle={styles.successScreen}>
        <Text style={styles.brand}>DOINFAM</Text>
        <Text style={styles.title}>Revisa tu correo</Text>
        <Text style={styles.subtitle}>Enviamos un enlace de confirmación a {email.trim().toLowerCase()}.</Text>
        <View style={styles.successActions}>
          <Button label="Ir a iniciar sesión" onPress={switchMode} />
          <Button label="Volver" variant="ghost" onPress={() => router.replace('/welcome')} />
        </View>
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <Screen contentStyle={styles.screen}>
        <View>
          <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/welcome')} hitSlop={12}><Text style={styles.back}>‹ Volver</Text></Pressable>
          <Text style={styles.brand}>DOINFAM</Text>
          <Text style={styles.title}>{isSignUp ? 'Crea tu cuenta' : 'Entra a DoInFam'}</Text>
          <Text style={styles.subtitle}>{isSignUp ? 'Luego podrás crear una familia o unirte con un código.' : 'Usa tu correo y contraseña para continuar.'}</Text>
        </View>
        <View style={styles.form}>
          <TextInput autoCapitalize="none" autoComplete="email" keyboardType="email-address" label="Correo" placeholder="tu@correo.com" value={email} onChangeText={setEmail} />
          <TextInput autoCapitalize="none" autoComplete={isSignUp ? 'new-password' : 'current-password'} label="Contraseña" placeholder="Mínimo 8 caracteres" secureTextEntry value={password} onChangeText={setPassword} />
          {isSignUp ? <TextInput autoCapitalize="none" autoComplete="new-password" label="Repite la contraseña" placeholder="Escríbela nuevamente" secureTextEntry value={confirmation} onChangeText={setConfirmation} /> : null}
          {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
          <Button label={isSignUp ? 'Continuar' : 'Entrar'} loading={submitting} onPress={() => void submit()} />
          <Pressable disabled={submitting} onPress={switchMode} hitSlop={10}>
            <Text style={styles.switch}>{isSignUp ? '¿Ya tienes cuenta? Iniciar sesión' : '¿Primera vez? Crear cuenta'}</Text>
          </Pressable>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { paddingTop: spacing.md },
  back: { ...typography.bodyMedium, color: colors.primary, marginBottom: 48 },
  brand: { ...typography.label, color: colors.primary, fontSize: 15, lineHeight: 20 },
  title: { ...typography.display, color: colors.text, marginTop: spacing.sm, maxWidth: 330 },
  subtitle: { ...typography.body, color: colors.textSecondary, fontSize: 15, lineHeight: 22, marginTop: spacing.sm, maxWidth: 330 },
  form: { gap: spacing.md, marginTop: 42 },
  error: { ...typography.caption, color: colors.danger, marginTop: -spacing.xs },
  switch: { fontFamily: fontFamilies.semibold, fontSize: 14, lineHeight: 20, color: colors.primary, textAlign: 'center', marginTop: spacing.xs },
  successScreen: { justifyContent: 'center', alignItems: 'center' },
  successActions: { alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.xxl },
});
