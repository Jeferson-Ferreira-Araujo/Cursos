import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button, EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui';
import { typography } from '@/theme';
import { useAuth } from '@/domain/auth/AuthContext';
import { useAsyncData } from '@/hooks/useAsyncData';
import { fetchCreatorCourses, getCoverPublicUrl } from '@/domain/courses/api';
import { CourseListItem } from '@/domain/courses/components/CourseListItem';

export default function CoursesScreen() {
  const { account } = useAuth();
  const { data: courses, loading, error, refresh, refreshing } = useAsyncData(
    () => fetchCreatorCourses(account!.id),
    [account?.id]
  );

  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      <View style={styles.header}>
        <View>
          <Text style={typography.h1}>Cursos</Text>
          <Text style={styles.subtitle}>Gerencie seus cursos.</Text>
        </View>
      </View>

      <Button label="+ Criar curso" onPress={() => router.push('/(creator)/courses/new')} fullWidth={false} />

      {loading && <LoadingState />}
      {!!error && <ErrorState message={error} onRetry={refresh} />}
      {!loading && !error && (courses?.length ?? 0) === 0 && (
        <EmptyState
          title="Nenhum curso ainda"
          description="Crie seu primeiro curso e comece a enviar aulas."
          actionLabel="Criar curso"
          onAction={() => router.push('/(creator)/courses/new')}
        />
      )}
      {(courses ?? []).map((course) => (
        <CourseListItem
          key={course.id}
          course={course}
          coverUrl={getCoverPublicUrl(course.cover_path)}
          onPress={() => router.push(`/(creator)/courses/${course.id}`)}
        />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subtitle: { ...typography.caption, marginTop: 2 },
});
