import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Card } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';
import { formatDuration } from '@/utils/format';
import type { LessonProgressStatus } from '@/domain/progress/types';
import type { LessonWithVideo } from '../types';

export function StudentLessonListItem({
  index,
  lesson,
  status,
  onPress,
}: {
  index: number;
  lesson: LessonWithVideo;
  status: LessonProgressStatus;
  onPress: () => void;
}) {
  const isCompleted = status === 'completed';

  return (
    <Pressable onPress={onPress}>
      <Card style={styles.card}>
        <Ionicons
          name={isCompleted ? 'checkmark-circle' : 'play-circle-outline'}
          size={26}
          color={isCompleted ? colors.success : colors.primary}
        />
        <Text style={styles.index}>{index + 1}</Text>
        <Text style={styles.title} numberOfLines={1}>
          {lesson.title}
        </Text>
        <Text style={styles.duration}>{formatDuration(lesson.video?.duration_seconds)}</Text>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  index: { ...typography.caption, width: 18 },
  title: { ...typography.body, flex: 1 },
  duration: { ...typography.small },
});
