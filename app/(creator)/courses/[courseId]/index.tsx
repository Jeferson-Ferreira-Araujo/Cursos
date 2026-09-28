import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Badge, Button, EmptyState, ErrorState, LoadingState, Screen, TopBar } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';
import { useAsyncData } from '@/hooks/useAsyncData';
import { fetchCourse, setCourseStatus, deleteCourse } from '@/domain/courses/api';
import { fetchLessons, reorderLessons } from '@/domain/lessons/api';
import { LessonListItem } from '@/domain/lessons/components/LessonListItem';
import { getErrorMessage } from '@/utils/errors';

export default function CourseOverviewScreen() {
  const { courseId } = useLocalSearchParams<{ courseId: string }>();
  const [publishing, setPublishing] = useState(false);

  const { data: course, loading: loadingCourse, error: courseError, reload: reloadCourse } = useAsyncData(
    () => fetchCourse(courseId),
    [courseId]
  );
  const { data: lessons, loading: loadingLessons, error: lessonsError, refresh, refreshing } = useAsyncData(
    () => fetchLessons(courseId),
    [courseId]
  );

  async function handleTogglePublish() {
    if (!course) return;
    const nextStatus = course.status === 'published' ? 'draft' : 'published';
    if (nextStatus === 'published' && (lessons?.length ?? 0) === 0) {
      Alert.alert('Adicione aulas antes de publicar', 'Envie pelo menos um vídeo para publicar este curso.');
      return;
    }
    setPublishing(true);
    try {
      await setCourseStatus(course.id, nextStatus);
      await reloadCourse();
    } catch (err) {
      Alert.alert('Erro', getErrorMessage(err));
    } finally {
      setPublishing(false);
    }
  }

  function handleDelete() {
    if (!course) return;
    Alert.alert('Excluir curso', `Tem certeza que deseja excluir "${course.title}"? Essa ação não pode ser desfeita.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteCourse(course.id);
            router.replace('/(creator)/courses');
          } catch (err) {
            Alert.alert('Erro', getErrorMessage(err));
          }
        },
      },
    ]);
  }

  async function moveLesson(index: number, direction: -1 | 1) {
    if (!lessons) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= lessons.length) return;
    const reordered = [...lessons];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved!);
    try {
      await reorderLessons(reordered.map((l) => l.id));
      await refresh();
    } catch (err) {
      Alert.alert('Erro ao reordenar', getErrorMessage(err));
    }
  }

  if (loadingCourse) return <LoadingState />;
  if (courseError || !course) return <ErrorState message={courseError ?? 'Curso não encontrado.'} onRetry={reloadCourse} />;

  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      <TopBar title={course.title} />

      <View style={styles.statusRow}>
        <Badge label={course.status === 'published' ? 'Publicado' : 'Rascunho'} tone={course.status === 'published' ? 'success' : 'warning'} />
        <Button
          label={course.status === 'published' ? 'Despublicar' : 'Publicar curso'}
          variant={course.status === 'published' ? 'secondary' : 'primary'}
          onPress={handleTogglePublish}
          loading={publishing}
          fullWidth={false}
        />
      </View>

      <View style={styles.actionsRow}>
        <Button label="Editar curso" variant="secondary" fullWidth={false} onPress={() => router.push(`/(creator)/courses/${course.id}/edit`)} />
        <Button label="✨ Savia Studio" variant="secondary" fullWidth={false} onPress={() => router.push(`/(creator)/courses/${course.id}/studio`)} />
        <Button label="✨ Gerar capa" variant="secondary" fullWidth={false} onPress={() => router.push(`/(creator)/courses/${course.id}/cover`)} />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={typography.h3}>Aulas ({lessons?.length ?? 0})</Text>
        <Button label="+ Adicionar aula" variant="ghost" fullWidth={false} onPress={() => router.push(`/(creator)/courses/${course.id}/add-lessons`)} />
      </View>

      {loadingLessons && <LoadingState />}
      {!!lessonsError && <ErrorState message={lessonsError} onRetry={refresh} />}
      {!loadingLessons && !lessonsError && (lessons?.length ?? 0) === 0 && (
        <EmptyState
          title="Nenhuma aula ainda"
          description="Envie os vídeos que já possui e transforme-os em aulas."
          actionLabel="Enviar vídeos"
          onAction={() => router.push(`/(creator)/courses/${course.id}/add-lessons`)}
        />
      )}
      {(lessons ?? []).map((lesson, index) => (
        <LessonListItem
          key={lesson.id}
          index={index}
          lesson={lesson}
          canMoveUp={index > 0}
          canMoveDown={index < (lessons?.length ?? 0) - 1}
          onMoveUp={() => moveLesson(index, -1)}
          onMoveDown={() => moveLesson(index, 1)}
          onPress={() => router.push(`/(creator)/courses/${course.id}/lessons/${lesson.id}`)}
        />
      ))}

      <View style={styles.dangerZone}>
        <Button label="Excluir curso" variant="danger" onPress={handleDelete} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dangerZone: { marginTop: spacing.xl, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border },
});
