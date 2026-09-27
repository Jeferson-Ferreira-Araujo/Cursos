import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, ErrorState, LoadingState, ProgressBar, Screen, TopBar } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';
import { useAuth } from '@/domain/auth/AuthContext';
import { useAsyncData } from '@/hooks/useAsyncData';
import { fetchCourse } from '@/domain/courses/api';
import { fetchLessons } from '@/domain/lessons/api';
import { fetchCourseProgress } from '@/domain/progress/api';
import { StudentLessonListItem } from '@/domain/lessons/components/StudentLessonListItem';

export default function StudentCourseScreen() {
  const { courseId } = useLocalSearchParams<{ courseId: string }>();
  const { session } = useAuth();
  const studentId = session!.user.id;

  const { data: course, loading: loadingCourse, error: courseError, reload: reloadCourse } = useAsyncData(
    () => fetchCourse(courseId),
    [courseId]
  );
  const { data: lessons, loading: loadingLessons, error: lessonsError, refresh, refreshing } = useAsyncData(
    () => fetchLessons(courseId),
    [courseId]
  );
  const { data: progress, refresh: refreshProgress } = useAsyncData(
    () => fetchCourseProgress(courseId, studentId),
    [courseId, studentId]
  );

  const totalLessons = lessons?.length ?? 0;
  const completedCount = lessons?.filter((l) => progress?.[l.id]?.status === 'completed').length ?? 0;
  const overallProgress = totalLessons > 0 ? completedCount / totalLessons : 0;

  const nextLesson = lessons?.find((l) => progress?.[l.id]?.status !== 'completed') ?? lessons?.[0];

  async function handleRefreshAll() {
    await Promise.all([refresh(), refreshProgress(), reloadCourse()]);
  }

  if (loadingCourse) return <LoadingState />;
  if (courseError || !course) return <ErrorState message={courseError ?? 'Curso não encontrado.'} onRetry={reloadCourse} />;

  return (
    <Screen onRefresh={handleRefreshAll} refreshing={refreshing}>
      <TopBar title={course.title} onBack={() => router.replace('/(student)')} />

      <Card style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <Text style={typography.bodyMedium}>Seu progresso</Text>
          <Text style={styles.progressPercent}>{Math.round(overallProgress * 100)}%</Text>
        </View>
        <ProgressBar progress={overallProgress} />
        <Text style={styles.progressLabel}>
          {completedCount} de {totalLessons} aulas concluídas
        </Text>
        {!!nextLesson && (
          <Button
            label={completedCount === 0 ? 'Começar' : overallProgress === 1 ? 'Rever aulas' : 'Continuar'}
            onPress={() => router.push(`/(student)/courses/${courseId}/lessons/${nextLesson.id}`)}
          />
        )}
      </Card>

      <Text style={typography.h3}>Aulas</Text>

      {loadingLessons && <LoadingState />}
      {!!lessonsError && <ErrorState message={lessonsError} onRetry={refresh} />}
      {(lessons ?? []).map((lesson, index) => (
        <StudentLessonListItem
          key={lesson.id}
          index={index}
          lesson={lesson}
          status={progress?.[lesson.id]?.status ?? 'not_started'}
          onPress={() => router.push(`/(student)/courses/${courseId}/lessons/${lesson.id}`)}
        />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  progressCard: { gap: spacing.sm },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  progressPercent: { ...typography.bodyMedium, color: colors.primary },
  progressLabel: { ...typography.caption },
});
