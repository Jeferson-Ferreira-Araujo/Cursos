import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams, useRootNavigationState } from 'expo-router';
import * as Linking from 'expo-linking';
import { Button, Screen, TextField, LoadingState } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';
import { exchangeRecoveryCode, updatePassword } from '@/domain/auth/api';
import { supabase } from '@/lib/supabase';
import { resetPasswordSchema, validate } from '@/utils/validation';
import { getErrorMessage } from '@/utils/errors';

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ code?: string }>();
  const navigationState = useRootNavigationState();
  const [exchanging, setExchanging] = useState(true);
  const [exchangeError, setExchangeError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!navigationState?.key) return;

    (async () => {
      try {
        if (params.code) {
          const url = Linking.createURL('reset-password', { queryParams: { code: params.code } });
          await exchangeRecoveryCode(url);
        }
      } catch (err) {
        setExchangeError(getErrorMessage(err));
      } finally {
        setExchanging(false);
      }
    })();
  }, [navigationState?.key, params.code]);

  async function handleSubmit() {
    const result = validate(resetPasswordSchema, { password });
    if (!result.success) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setFormError(null);
    setLoading(true);
    try {
      await updatePassword(result.data.password);
      await supabase.auth.signOut();
      setDone(true);
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  if (exchanging) return <LoadingState label="Validando link..." />;

  if (done) {
    return (
      <Screen>
        <View style={styles.header}>
          <Text style={typography.h1}>Senha atualizada</Text>
          <Text style={styles.subtitle}>Sua senha foi redefinida. Entre novamente para continuar.</Text>
        </View>
        <Button label="Ir para o login" onPress={() => router.replace('/(auth)/login')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={typography.h1}>Nova senha</Text>
        <Text style={styles.subtitle}>Escolha uma nova senha para sua conta.</Text>
      </View>

      {!!exchangeError && <Text style={styles.formError}>{exchangeError} Solicite um novo link.</Text>}

      <View style={styles.form}>
        <TextField label="Nova senha" placeholder="Sua nova senha" secureTextEntry value={password} onChangeText={setPassword} error={errors.password} />
        {!!formError && <Text style={styles.formError}>{formError}</Text>}
        <Button label="Salvar nova senha" onPress={handleSubmit} loading={loading} disabled={!!exchangeError} />
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
