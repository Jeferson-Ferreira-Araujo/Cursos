import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '@/domain/auth/AuthContext';
import { LoadingState } from '@/components/ui';
import { colors } from '@/theme';

export default function StudentLayout() {
  const { bootstrapping, session, needsOnboarding } = useAuth();

  if (bootstrapping) return <LoadingState />;
  if (!session) return <Redirect href="/(auth)/login" />;
  if (needsOnboarding) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { borderTopColor: colors.border, backgroundColor: colors.surface },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Meus cursos', tabBarIcon: ({ color, size }) => <Ionicons name="book" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="courses"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Meu perfil', tabBarIcon: ({ color, size }) => <Ionicons name="person" color={color} size={size} /> }}
      />
    </Tabs>
  );
}
