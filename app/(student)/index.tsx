import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button, EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui';
import { typography } from '@/theme';
import { useAuth } from '@/domain/auth/AuthContext';
import { useAsyncData } from '@/hooks/useAsyncData';
import { fetchStudentCourses, getCoverPublicUrl } from '@/domain/courses/api';
import { StudentCourseCard } from '@/domain/courses/components/StudentCourseCard';
import { getErrorMessage } from '@/utils/errors';

export default function MyCoursesScreen() {
  const { account, profile, becomeCreator } = useAuth();
  const { data: courses, loading, error, refresh, refreshing } = useAsyncData(() => fetchStudentCourses(), []);
  const [switching, setSwitching] = useState(false);

  async function handleCreateCourse() {
    setSwitching(true);
    try {
      const accountName = account ? undefined : `Cursos de ${profile?.full_name || 'você'}`;
      await becomeCreator(accountName ?? '');
      router.replace('/(creator)');
    } catch (err) {
      Alert.alert('Erro', getErrorMessage(err));
    } finally {
      setSwitching(false);
    }
  }

  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      <View style={styles.header}>
        <View>
          <Text style={typography.h1}>Meus cursos</Text>
          <Text style={styles.subtitle}>Continue aprendendo no seu ritmo.</Text>
        </View>
      </View>

      <Button
        label={account ? 'Ir para meus cursos criados' : 'Criar meu curso'}
        variant="secondary"
        fullWidth={false}
        loading={switching}
        onPress={handleCreateCourse}
      />

      {loading && <LoadingState />}
      {!!error && <ErrorState message={error} onRetry={refresh} />}
      {!loading && !error && (courses?.length ?? 0) === 0 && (
        <EmptyState
          title="Nenhum curso por aqui ainda"
          description="Quando alguém liberar acesso a um curso para você, ele aparece aqui."
        />
      )}
      {(courses ?? []).map((course) => (
        <StudentCourseCard
          key={course.id}
          course={course}
          coverUrl={getCoverPublicUrl(course.cover_path)}
          onPress={() => router.push(`/(student)/courses/${course.id}`)}
        />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subtitle: { ...typography.caption, marginTop: 2 },
});
