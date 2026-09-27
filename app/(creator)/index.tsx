import { StyleSheet, Text, View } from 'react-native';
import { Link, router } from 'expo-router';
import { Avatar, Button, Card, EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';
import { useAuth } from '@/domain/auth/AuthContext';
import { useAsyncData } from '@/hooks/useAsyncData';
import { fetchCreatorCourses, getCoverPublicUrl } from '@/domain/courses/api';
import { CourseListItem } from '@/domain/courses/components/CourseListItem';

export default function CreatorHomeScreen() {
  const { account, profile } = useAuth();
  const { data: courses, loading, error, refresh, refreshing } = useAsyncData(
    () => fetchCreatorCourses(account!.id),
    [account?.id]
  );

  const studentCount = (courses ?? []).reduce((sum, c) => sum + c.student_count, 0);

  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      <View style={styles.header}>
        <View>
          <Text style={typography.h2}>Olá, {firstName(profile?.full_name)}! 👋</Text>
          <Text style={styles.subtitle}>Continue de onde parou.</Text>
        </View>
        <Avatar name={profile?.full_name ?? '?'} size={44} />
      </View>

      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{courses?.length ?? 0}</Text>
          <Text style={styles.statLabel}>Cursos</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{studentCount}</Text>
          <Text style={styles.statLabel}>Alunos</Text>
        </Card>
      </View>

      <Button label="+ Criar curso" onPress={() => router.push('/(creator)/courses/new')} />

      <View style={styles.sectionHeader}>
        <Text style={typography.h3}>Seus cursos</Text>
        <Link href="/(creator)/courses" style={styles.link}>
          Ver todos
        </Link>
      </View>

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
      {(courses ?? []).slice(0, 5).map((course) => (
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

function firstName(fullName?: string | null) {
  if (!fullName) return '';
  return fullName.trim().split(/\s+/)[0] ?? '';
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subtitle: { ...typography.caption },
  statsRow: { flexDirection: 'row', gap: spacing.md },
  statCard: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { ...typography.h1, color: colors.primary },
  statLabel: { ...typography.caption },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm },
  link: { ...typography.caption, color: colors.primary, fontWeight: '600' },
});
