import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Button, Card, LoadingState, Screen, TextField, TopBar } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';
import { useAuth } from '@/domain/auth/AuthContext';
import { useAsyncData } from '@/hooks/useAsyncData';
import { fetchCreatorCourses } from '@/domain/courses/api';
import { addStudent, grantCourseAccess } from '@/domain/students/api';
import { addStudentSchema, validate } from '@/utils/validation';
import { getErrorMessage } from '@/utils/errors';

export default function NewStudentScreen() {
  const { account } = useAuth();
  const { data: courses, loading: loadingCourses } = useAsyncData(() => fetchCreatorCourses(account!.id), [account?.id]);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function toggleCourse(courseId: string) {
    setSelectedCourseIds((current) =>
      current.includes(courseId) ? current.filter((id) => id !== courseId) : [...current, courseId]
    );
  }

  async function handleSubmit() {
    const result = validate(addStudentSchema, { fullName, email });
    if (!result.success) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setFormError(null);
    setSaving(true);
    try {
      const invitation = await addStudent(account!.id, result.data.email, result.data.fullName);
      await Promise.all(selectedCourseIds.map((courseId) => grantCourseAccess(courseId, invitation.id)));
      router.replace(`/(creator)/students/${invitation.id}`);
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <TopBar title="Adicionar aluno" />
      <Text style={styles.hint}>O aluno receberá acesso com o e-mail cadastrado.</Text>

      <TextField label="Nome do aluno" placeholder="Nome completo" value={fullName} onChangeText={setFullName} error={errors.fullName} />
      <TextField
        label="E-mail"
        placeholder="aluno@email.com"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        error={errors.email}
      />

      <View style={styles.coursesSection}>
        <Text style={typography.bodyMedium}>Cursos</Text>
        {loadingCourses && <LoadingState label="Carregando cursos..." />}
        {!loadingCourses && (courses?.length ?? 0) === 0 && (
          <Text style={styles.hint}>Crie um curso primeiro para poder liberar acesso.</Text>
        )}
        {(courses ?? []).map((course) => {
          const selected = selectedCourseIds.includes(course.id);
          return (
            <Pressable key={course.id} onPress={() => toggleCourse(course.id)}>
              <Card style={styles.courseRow}>
                <Ionicons
                  name={selected ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={selected ? colors.primary : colors.textMuted}
                />
                <Text style={styles.courseTitle} numberOfLines={1}>
                  {course.title}
                </Text>
              </Card>
            </Pressable>
          );
        })}
      </View>

      {!!formError && <Text style={styles.formError}>{formError}</Text>}

      <View style={styles.actions}>
        <Button label="Cancelar" variant="secondary" onPress={() => router.back()} />
        <Button label="Adicionar aluno" onPress={handleSubmit} loading={saving} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { ...typography.caption },
  coursesSection: { gap: spacing.sm },
  courseRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  courseTitle: { ...typography.body, flex: 1 },
  formError: { ...typography.caption, color: colors.danger },
  actions: { flexDirection: 'row', gap: spacing.sm },
});
