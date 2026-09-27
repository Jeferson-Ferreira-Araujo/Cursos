import { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Avatar, Badge, Button, Card, ErrorState, LoadingState, ProgressBar, Screen, TopBar } from '@/components/ui';
import { spacing, typography } from '@/theme';
import { useAuth } from '@/domain/auth/AuthContext';
import { useAsyncData } from '@/hooks/useAsyncData';
import { fetchStudent, grantCourseAccess, revokeCourseAccess } from '@/domain/students/api';
import { fetchCreatorCourses } from '@/domain/courses/api';
import { getErrorMessage } from '@/utils/errors';

export default function StudentProfileScreen() {
  const { studentId } = useLocalSearchParams<{ studentId: string }>();
  const { account } = useAuth();
  const [pendingCourseId, setPendingCourseId] = useState<string | null>(null);

  const { data: student, loading, error, reload } = useAsyncData(() => fetchStudent(studentId), [studentId]);
  const { data: allCourses } = useAsyncData(() => fetchCreatorCourses(account!.id), [account?.id]);

  const coursesNotEnrolled = useMemo(() => {
    if (!allCourses || !student) return [];
    const activeCourseIds = new Set(student.enrollments.filter((e) => e.status === 'active').map((e) => e.course_id));
    return allCourses.filter((c) => !activeCourseIds.has(c.id));
  }, [allCourses, student]);

  async function handleGrant(courseId: string) {
    if (!student) return;
    setPendingCourseId(courseId);
    try {
      await grantCourseAccess(courseId, student.id);
      await reload();
    } catch (err) {
      Alert.alert('Erro', getErrorMessage(err));
    } finally {
      setPendingCourseId(null);
    }
  }

  function handleRevoke(enrollmentId: string, courseTitle: string) {
    Alert.alert('Remover acesso', `Remover o acesso de ${student?.full_name || 'aluno'} ao curso "${courseTitle}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          setPendingCourseId(enrollmentId);
          try {
            await revokeCourseAccess(enrollmentId);
            await reload();
          } catch (err) {
            Alert.alert('Erro', getErrorMessage(err));
          } finally {
            setPendingCourseId(null);
          }
        },
      },
    ]);
  }

  if (loading) return <LoadingState />;
  if (error || !student) return <ErrorState message={error ?? 'Aluno não encontrado.'} onRetry={reload} />;

  const activeEnrollments = student.enrollments.filter((e) => e.status === 'active');

  return (
    <Screen>
      <TopBar title={student.full_name || student.email} />

      <View style={styles.profileHeader}>
        <Avatar name={student.full_name || student.email} size={64} />
        <Text style={typography.h3}>{student.full_name || 'Sem nome'}</Text>
        <Text style={styles.email}>{student.email}</Text>
        <Badge label={student.user_id ? 'Ativo' : 'Aguardando cadastro'} tone={student.user_id ? 'success' : 'neutral'} />
      </View>

      <Text style={typography.h3}>Cursos ({activeEnrollments.length})</Text>
      {activeEnrollments.length === 0 && <Text style={styles.hint}>Nenhum curso liberado ainda.</Text>}
      {activeEnrollments.map((enrollment) => {
        const progress = enrollment.total_lessons > 0 ? enrollment.completed_lessons / enrollment.total_lessons : 0;
        return (
          <Card key={enrollment.id} style={styles.courseCard}>
            <View style={styles.courseCardHeader}>
              <Text style={typography.bodyMedium} numberOfLines={1}>
                {enrollment.course_title}
              </Text>
              <Button
                label="Remover acesso"
                variant="ghost"
                fullWidth={false}
                loading={pendingCourseId === enrollment.id}
                onPress={() => handleRevoke(enrollment.id, enrollment.course_title)}
              />
            </View>
            <ProgressBar progress={progress} />
            <Text style={styles.progressLabel}>
              {enrollment.completed_lessons} de {enrollment.total_lessons} aulas
            </Text>
          </Card>
        );
      })}

      {coursesNotEnrolled.length > 0 && (
        <>
          <Text style={typography.h3}>Dar acesso a outro curso</Text>
          {coursesNotEnrolled.map((course) => (
            <Card key={course.id} style={styles.grantRow}>
              <Text style={typography.body} numberOfLines={1}>
                {course.title}
              </Text>
              <Button
                label="Dar acesso"
                variant="secondary"
                fullWidth={false}
                loading={pendingCourseId === course.id}
                onPress={() => handleGrant(course.id)}
              />
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  profileHeader: { alignItems: 'center', gap: spacing.xs },
  email: { ...typography.caption },
  hint: { ...typography.caption },
  courseCard: { gap: spacing.sm },
  courseCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  progressLabel: { ...typography.small },
  grantRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
