import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Badge, Card, ProgressBar } from '@/components/ui';
import { colors, radius, spacing, typography } from '@/theme';
import type { StudentCourse } from '../types';

export function StudentCourseCard({
  course,
  coverUrl,
  onPress,
}: {
  course: StudentCourse;
  coverUrl: string | null;
  onPress: () => void;
}) {
  const progress = course.total_lessons > 0 ? course.completed_lessons / course.total_lessons : 0;
  const isCompleted = course.total_lessons > 0 && course.completed_lessons === course.total_lessons;

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
          <View style={styles.titleRow}>
            <Text style={typography.bodyMedium} numberOfLines={1}>
              {course.title}
            </Text>
            {isCompleted && <Badge label="Concluído" tone="success" />}
          </View>
          <ProgressBar progress={progress} />
          <Text style={styles.meta}>
            {course.completed_lessons} de {course.total_lessons} aulas
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  cover: { width: '100%', height: 120, borderRadius: radius.md, overflow: 'hidden' },
  coverImage: { width: '100%', height: '100%' },
  coverPlaceholder: { width: '100%', height: '100%', backgroundColor: colors.primarySoft },
  info: { gap: spacing.xs },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  meta: { ...typography.small },
});
