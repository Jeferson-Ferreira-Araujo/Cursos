import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Screen, TextField } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';
import { requestPasswordReset } from '@/domain/auth/api';
import { forgotPasswordSchema, validate } from '@/utils/validation';
import { getErrorMessage } from '@/utils/errors';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit() {
    const result = validate(forgotPasswordSchema, { email });
    if (!result.success) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setFormError(null);
    setLoading(true);
    try {
      await requestPasswordReset(result.data.email);
      setSent(true);
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <Screen>
        <View style={styles.header}>
          <Text style={typography.h1}>Verifique seu e-mail</Text>
          <Text style={styles.subtitle}>
            Enviamos um link para {email}. Abra-o neste aparelho para criar uma nova senha.
          </Text>
        </View>
        <Button label="Voltar para o login" variant="secondary" onPress={() => router.replace('/(auth)/login')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={typography.h1}>Recuperar senha</Text>
        <Text style={styles.subtitle}>Enviaremos um link de redefinição para o seu e-mail.</Text>
      </View>

      <View style={styles.form}>
        <TextField
          label="E-mail"
          placeholder="seu@email.com"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          error={errors.email}
        />
        {!!formError && <Text style={styles.formError}>{formError}</Text>}
        <Button label="Enviar link" onPress={handleSubmit} loading={loading} />
        <Button label="Voltar" variant="ghost" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs },
  subtitle: { ...typography.body, color: colors.textSecondary },
  form: { gap: spacing.md, marginTop: spacing.lg },
  formError: { ...typography.caption, color: colors.danger },
});
