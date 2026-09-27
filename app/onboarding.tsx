import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { Button, Card, Logo, Screen, TextField } from '@/components/ui';
import { colors, radius, spacing, typography } from '@/theme';
import { useAuth } from '@/domain/auth/AuthContext';
import { updateMyProfile } from '@/domain/auth/api';
import { createCreatorAccount } from '@/domain/accounts/api';
import { nameSchema, validate } from '@/utils/validation';
import { getErrorMessage } from '@/utils/errors';

type Role = 'creator' | 'student';

export default function OnboardingScreen() {
  const { session, profile, refreshAccount, refreshProfile } = useAuth();
  const [role, setRole] = useState<Role | null>(null);
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [businessName, setBusinessName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!session) return <Redirect href="/(auth)/login" />;

  async function handleContinue() {
    if (!role) return;
    const result = validate(nameSchema, fullName);
    if (!result.success) {
      setError('Informe seu nome.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      if (role === 'creator') {
        await createCreatorAccount(businessName.trim() || result.data);
      }
      await updateMyProfile(session!.user.id, { full_name: result.data, onboarding_completed: true });
      await Promise.all([refreshProfile(), refreshAccount()]);
      router.replace('/');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Logo size={48} />
      <View style={styles.header}>
        <Text style={typography.h1}>Vamos configurar sua conta?</Text>
        <Text style={styles.subtitle}>Isso nos ajuda a personalizar sua experiência.</Text>
      </View>

      <View style={styles.roles}>
        <RoleCard
          title="Sou Criador"
          description="Quero criar cursos e ensinar meus alunos."
          selected={role === 'creator'}
          onPress={() => setRole('creator')}
        />
        <RoleCard
          title="Sou Aluno"
          description="Recebi acesso a um curso de alguém."
          selected={role === 'student'}
          onPress={() => setRole('student')}
        />
      </View>

      {!!role && (
        <View style={styles.form}>
          <TextField label="Seu nome" placeholder="Como podemos te chamar?" value={fullName} onChangeText={setFullName} />
          {role === 'creator' && (
            <TextField
              label="Nome do seu negócio (opcional)"
              placeholder="Ex.: Studio Ana Silva"
              value={businessName}
              onChangeText={setBusinessName}
            />
          )}
          {!!error && <Text style={styles.error}>{error}</Text>}
          <Button label="Continuar" onPress={handleContinue} loading={loading} />
        </View>
      )}
    </Screen>
  );
}

function RoleCard({
  title,
  description,
  selected,
  onPress,
}: {
  title: string;
  description: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <Card style={[styles.roleCard, selected && styles.roleCardSelected] as object}>
        <Text style={[typography.h3, selected && { color: colors.primary }]}>{title}</Text>
        <Text style={styles.roleDescription}>{description}</Text>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs, marginTop: spacing.lg },
  subtitle: { ...typography.body, color: colors.textSecondary },
  roles: { gap: spacing.md, marginTop: spacing.lg },
  roleCard: { gap: spacing.xs, borderRadius: radius.lg },
  roleCardSelected: { borderColor: colors.primary, borderWidth: 2 },
  roleDescription: { ...typography.caption },
  form: { gap: spacing.md, marginTop: spacing.xl },
  error: { ...typography.caption, color: colors.danger },
});
