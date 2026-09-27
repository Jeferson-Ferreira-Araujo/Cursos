import { Redirect } from 'expo-router';
import { useAuth } from '@/domain/auth/AuthContext';
import { LoadingState } from '@/components/ui';

export default function Index() {
  const { bootstrapping, session, needsOnboarding, activeRole } = useAuth();

  if (bootstrapping) return <LoadingState label="Preparando o Savia..." />;
  if (!session) return <Redirect href="/(auth)/login" />;
  if (needsOnboarding) return <Redirect href="/onboarding" />;
  if (activeRole === 'creator') return <Redirect href="/(creator)" />;
  return <Redirect href="/(student)" />;
}
