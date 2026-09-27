import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Badge, Card } from '@/components/ui';
import { colors, radius, spacing, typography } from '@/theme';
import type { CourseWithStats } from '../types';

export function CourseListItem({
  course,
  coverUrl,
  onPress,
}: {
  course: CourseWithStats;
  coverUrl: string | null;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <Card style={styles.card}>
        <View style={styles.cover}>
          {coverUrl ? (
            <Image source={{ uri: coverUrl }} style={styles.coverImage} contentFit="cover" />
          ) : (
            <View style={styles.coverPlaceholder} />
          )}
        </View>
        <View style={styles.info}>
          <Text style={typography.bodyMedium} numberOfLines={1}>
            {course.title}
          </Text>
          <Text style={styles.meta}>
            {course.lesson_count} {course.lesson_count === 1 ? 'aula' : 'aulas'} · {course.student_count}{' '}
            {course.student_count === 1 ? 'aluno' : 'alunos'}
          </Text>
        </View>
        <Badge label={course.status === 'published' ? 'Publicado' : 'Rascunho'} tone={course.status === 'published' ? 'success' : 'warning'} />
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cover: { width: 56, height: 56, borderRadius: radius.md, overflow: 'hidden' },
  coverImage: { width: '100%', height: '100%' },
  coverPlaceholder: { width: '100%', height: '100%', backgroundColor: colors.primarySoft },
  info: { flex: 1, gap: 2 },
  meta: { ...typography.caption },
});
