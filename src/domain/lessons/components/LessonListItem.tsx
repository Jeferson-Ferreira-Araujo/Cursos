import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Badge, Card } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';
import { formatDuration } from '@/utils/format';
import type { LessonWithVideo } from '../types';

const VIDEO_STATUS_LABEL: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  ready: { label: 'Pronto', tone: 'success' },
  uploading: { label: 'Enviando...', tone: 'warning' },
  processing: { label: 'Processando...', tone: 'warning' },
  error: { label: 'Erro no envio', tone: 'danger' },
};

export function LessonListItem({
  index,
  lesson,
  onPress,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: {
  index: number;
  lesson: LessonWithVideo;
  onPress: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const status = lesson.video ? VIDEO_STATUS_LABEL[lesson.video.status] : undefined;

  return (
    <Card style={styles.card}>
      <Text style={styles.index}>{index + 1}</Text>
      <Pressable style={styles.info} onPress={onPress}>
        <Text style={typography.bodyMedium} numberOfLines={1}>
          {lesson.title}
        </Text>
        <Text style={styles.meta}>{formatDuration(lesson.video?.duration_seconds)}</Text>
      </Pressable>
      {!!status && <Badge label={status.label} tone={status.tone} />}
      <View style={styles.reorderButtons}>
        <Pressable onPress={onMoveUp} disabled={!canMoveUp} hitSlop={8}>
          <Ionicons name="chevron-up" size={18} color={canMoveUp ? colors.textSecondary : colors.border} />
        </Pressable>
        <Pressable onPress={onMoveDown} disabled={!canMoveDown} hitSlop={8}>
          <Ionicons name="chevron-down" size={18} color={canMoveDown ? colors.textSecondary : colors.border} />
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  index: { ...typography.caption, width: 20, textAlign: 'center' },
  info: { flex: 1, gap: 2 },
  meta: { ...typography.small },
  reorderButtons: { gap: 2 },
});
