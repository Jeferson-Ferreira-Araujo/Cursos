import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { Button, Screen, TextField, TopBar } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';
import { useAuth } from '@/domain/auth/AuthContext';
import { createCourse } from '@/domain/courses/api';
import { courseSchema, validate } from '@/utils/validation';
import { getErrorMessage } from '@/utils/errors';

export default function NewCourseScreen() {
  const { account, session } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    const result = validate(courseSchema, { title, description });
    if (!result.success) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setFormError(null);
    setLoading(true);
    try {
      const course = await createCourse(account!.id, result.data.title, result.data.description, session!.user.id);
      router.replace(`/(creator)/courses/${course.id}`);
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <TopBar title="Novo curso" />

      <Text style={styles.hint}>Comece com um nome. Você pode adicionar aulas e capa depois.</Text>

      <TextField label="Nome do curso" placeholder="Ex.: Curso de Cílios" value={title} onChangeText={setTitle} error={errors.title} />
      <TextField
        label="Descrição (opcional)"
        placeholder="Sobre o que é este curso?"
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={4}
        style={styles.textarea}
      />

      {!!formError && <Text style={styles.formError}>{formError}</Text>}

      <Button label="Criar curso" onPress={handleSubmit} loading={loading} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { ...typography.caption },
  textarea: { minHeight: 96, textAlignVertical: 'top', paddingTop: spacing.md },
  formError: { ...typography.caption, color: colors.danger },
});
