import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/domain/auth/AuthContext';

export default function AuthLayout() {
  const { bootstrapping, session } = useAuth();

  if (bootstrapping) return null;
  if (session) return <Redirect href="/" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
