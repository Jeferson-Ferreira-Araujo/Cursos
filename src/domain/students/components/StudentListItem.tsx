import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar, Badge, Card } from '@/components/ui';
import { spacing, typography } from '@/theme';
import type { StudentWithEnrollments } from '../types';

export function StudentListItem({ student, onPress }: { student: StudentWithEnrollments; onPress: () => void }) {
  const activeCourses = student.enrollments.filter((e) => e.status === 'active');

  return (
    <Pressable onPress={onPress}>
      <Card style={styles.card}>
        <Avatar name={student.full_name || student.email} size={44} />
        <View style={styles.info}>
          <Text style={typography.bodyMedium} numberOfLines={1}>
            {student.full_name || student.email}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {student.email}
          </Text>
        </View>
        <View style={styles.trailing}>
          <Text style={styles.courseCount}>
            {activeCourses.length} {activeCourses.length === 1 ? 'curso' : 'cursos'}
          </Text>
          <Badge
            label={student.user_id ? 'Ativo' : 'Aguardando cadastro'}
            tone={student.user_id ? 'success' : 'neutral'}
          />
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  info: { flex: 1, gap: 2 },
  meta: { ...typography.caption },
  trailing: { alignItems: 'flex-end', gap: 4 },
  courseCount: { ...typography.small },
});
