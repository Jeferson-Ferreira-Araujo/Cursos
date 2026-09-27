import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Link, router } from 'expo-router';
import { Button, Logo, Screen, TextField } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';
import { signInWithEmail } from '@/domain/auth/api';
import { loginSchema, validate } from '@/utils/validation';
import { getErrorMessage } from '@/utils/errors';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit() {
    const result = validate(loginSchema, { email, password });
    if (!result.success) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setFormError(null);
    setLoading(true);
    try {
      await signInWithEmail(result.data.email, result.data.password);
      router.replace('/');
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Logo size={56} />
      <View style={styles.header}>
        <Text style={typography.h1}>Bem-vindo de volta</Text>
        <Text style={styles.subtitle}>Acesse sua conta para continuar.</Text>
      </View>

      <View style={styles.form}>
        <TextField
          label="E-mail"
          placeholder="seu@email.com"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          error={errors.email}
        />
        <TextField
          label="Senha"
          placeholder="Sua senha"
          secureTextEntry
          autoCapitalize="none"
          value={password}
          onChangeText={setPassword}
          error={errors.password}
        />
        <Link href="/(auth)/forgot-password" style={styles.link}>
          Esqueceu sua senha?
        </Link>

        {!!formError && <Text style={styles.formError}>{formError}</Text>}

        <Button label="Entrar" onPress={handleSubmit} loading={loading} />
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Não tem uma conta?</Text>
        <Link href="/(auth)/signup" style={styles.footerLink}>
          Criar conta
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs, marginTop: spacing.lg },
  subtitle: { ...typography.body, color: colors.textSecondary },
  form: { gap: spacing.md, marginTop: spacing.md },
  link: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  formError: { ...typography.caption, color: colors.danger },
  footer: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.xl },
  footerText: { ...typography.caption },
  footerLink: { ...typography.caption, color: colors.primary, fontWeight: '700' },
});
