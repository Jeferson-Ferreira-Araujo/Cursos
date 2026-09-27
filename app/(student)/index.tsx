import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui';
import { typography } from '@/theme';
import { useAsyncData } from '@/hooks/useAsyncData';
import { fetchStudentCourses, getCoverPublicUrl } from '@/domain/courses/api';
import { StudentCourseCard } from '@/domain/courses/components/StudentCourseCard';

export default function MyCoursesScreen() {
  const { data: courses, loading, error, refresh, refreshing } = useAsyncData(() => fetchStudentCourses(), []);

  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      <View>
        <Text style={typography.h1}>Meus cursos</Text>
        <Text style={styles.subtitle}>Continue aprendendo no seu ritmo.</Text>
      </View>

      {loading && <LoadingState />}
      {!!error && <ErrorState message={error} onRetry={refresh} />}
      {!loading && !error && (courses?.length ?? 0) === 0 && (
        <EmptyState title="Nenhum curso por aqui ainda" description="Quando alguém liberar acesso a um curso para você, ele aparece aqui." />
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
  subtitle: { ...typography.caption, marginTop: 2 },
});
