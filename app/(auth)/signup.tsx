import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Link, router } from 'expo-router';
import { Button, Logo, Screen, TextField } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';
import { signUpWithEmail } from '@/domain/auth/api';
import { signupSchema, validate } from '@/utils/validation';
import { getErrorMessage } from '@/utils/errors';

export default function SignupScreen() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit() {
    const result = validate(signupSchema, { fullName, email, password });
    if (!result.success) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setFormError(null);
    setLoading(true);
    try {
      await signUpWithEmail(result.data.email, result.data.password, result.data.fullName);
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
        <Text style={typography.h1}>Criar sua conta</Text>
        <Text style={styles.subtitle}>Leva menos de um minuto.</Text>
      </View>

      <View style={styles.form}>
        <TextField label="Nome completo" placeholder="Seu nome" value={fullName} onChangeText={setFullName} error={errors.fullName} />
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
          placeholder="Crie uma senha"
          secureTextEntry
          autoCapitalize="none"
          value={password}
          onChangeText={setPassword}
          error={errors.password}
        />

        {!!formError && <Text style={styles.formError}>{formError}</Text>}

        <Button label="Criar conta" onPress={handleSubmit} loading={loading} />
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Já tem uma conta?</Text>
        <Link href="/(auth)/login" style={styles.footerLink}>
          Entrar
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs, marginTop: spacing.lg },
  subtitle: { ...typography.body, color: colors.textSecondary },
  form: { gap: spacing.md, marginTop: spacing.md },
  formError: { ...typography.caption, color: colors.danger },
  footer: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.xl },
  footerText: { ...typography.caption },
  footerLink: { ...typography.caption, color: colors.primary, fontWeight: '700' },
});
