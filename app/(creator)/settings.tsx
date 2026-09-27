import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Avatar, Button, Card, Screen, TextField } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';
import { useAuth } from '@/domain/auth/AuthContext';
import { updateMyProfile } from '@/domain/auth/api';
import { updateAccountName } from '@/domain/accounts/api';
import { signOut } from '@/domain/auth/api';
import { nameSchema, validate } from '@/utils/validation';
import { getErrorMessage } from '@/utils/errors';

export default function CreatorSettingsScreen() {
  const { session, profile, account, refreshProfile, refreshAccount } = useAuth();
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) setFullName(profile.full_name);
  }, [profile]);

  useEffect(() => {
    if (account) setBusinessName(account.name);
  }, [account]);

  async function handleSaveProfile() {
    const result = validate(nameSchema, fullName);
    if (!result.success) {
      setError('Informe seu nome.');
      return;
    }
    setError(null);
    setSavingProfile(true);
    try {
      await updateMyProfile(session!.user.id, { full_name: result.data });
      await refreshProfile();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleSaveAccount() {
    if (!account) return;
    setSavingAccount(true);
    try {
      await updateAccountName(account.id, businessName.trim() || account.name);
      await refreshAccount();
    } catch (err) {
      Alert.alert('Erro', getErrorMessage(err));
    } finally {
      setSavingAccount(false);
    }
  }

  function handleSignOut() {
    Alert.alert('Sair da conta', 'Tem certeza que deseja sair?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          try {
            await signOut();
          } finally {
            setSigningOut(false);
          }
        },
      },
    ]);
  }

  return (
    <Screen>
      <Text style={typography.h1}>Configurações</Text>

      <Card style={styles.profileCard}>
        <Avatar name={fullName || profile?.email || '?'} size={56} />
        <View style={styles.profileFields}>
          <TextField label="Seu nome" value={fullName} onChangeText={setFullName} />
          <Text style={styles.email}>{profile?.email}</Text>
        </View>
        {!!error && <Text style={styles.error}>{error}</Text>}
        <Button label="Salvar perfil" variant="secondary" onPress={handleSaveProfile} loading={savingProfile} />
      </Card>

      <Card style={styles.profileCard}>
        <Text style={typography.h3}>Negócio</Text>
        <TextField label="Nome do seu negócio" value={businessName} onChangeText={setBusinessName} />
        <Button label="Salvar" variant="secondary" onPress={handleSaveAccount} loading={savingAccount} />
      </Card>

      <Button label="Sair da conta" variant="danger" onPress={handleSignOut} loading={signingOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  profileCard: { gap: spacing.md },
  profileFields: { gap: spacing.sm },
  email: { ...typography.caption },
  error: { ...typography.caption, color: colors.danger },
});
