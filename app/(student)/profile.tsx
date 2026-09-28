import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Avatar, Button, Card, Screen, TextField } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';
import { useAuth } from '@/domain/auth/AuthContext';
import { signOut, updateMyProfile } from '@/domain/auth/api';
import { nameSchema, validate } from '@/utils/validation';
import { getErrorMessage } from '@/utils/errors';

export default function StudentProfileScreen() {
  const { session, profile, account, refreshProfile, setActiveRole, becomeCreator } = useAuth();
  const [fullName, setFullName] = useState('');
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) setFullName(profile.full_name);
  }, [profile]);

  async function handleSave() {
    const result = validate(nameSchema, fullName);
    if (!result.success) {
      setError('Informe seu nome.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await updateMyProfile(session!.user.id, { full_name: result.data });
      await refreshProfile();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleCreatorMode() {
    setSwitching(true);
    try {
      if (account) {
        setActiveRole('creator');
      } else {
        await becomeCreator(`Cursos de ${fullName || 'você'}`);
      }
      router.replace('/(creator)');
    } catch (err) {
      Alert.alert('Erro', getErrorMessage(err));
    } finally {
      setSwitching(false);
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
      <Text style={typography.h1}>Meu perfil</Text>

      <View style={styles.avatarSection}>
        <Avatar name={fullName || profile?.email || '?'} size={72} />
      </View>

      <Card style={styles.card}>
        <TextField label="Seu nome" value={fullName} onChangeText={setFullName} />
        <Text style={styles.email}>{profile?.email}</Text>
        {!!error && <Text style={styles.error}>{error}</Text>}
        <Button label="Salvar" variant="secondary" onPress={handleSave} loading={saving} />
      </Card>

      <Button
        label={account ? 'Ir para o modo Criador' : 'Criar meu curso'}
        variant="secondary"
        onPress={handleCreatorMode}
        loading={switching}
      />

      <Button label="Sair da conta" variant="danger" onPress={handleSignOut} loading={signingOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatarSection: { alignItems: 'center' },
  card: { gap: spacing.md },
  email: { ...typography.caption },
  error: { ...typography.caption, color: colors.danger },
});
