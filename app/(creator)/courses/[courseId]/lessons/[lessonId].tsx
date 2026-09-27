import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Badge, Button, ErrorState, LoadingState, Screen, TextField, TopBar } from '@/components/ui';
import { colors, typography } from '@/theme';
import { useAsyncData } from '@/hooks/useAsyncData';
import { fetchLesson, updateLesson, deleteLesson } from '@/domain/lessons/api';
import { videoProvider } from '@/domain/videos';
import { lessonSchema, validate } from '@/utils/validation';
import { getErrorMessage } from '@/utils/errors';

export default function EditLessonScreen() {
  const { lessonId } = useLocalSearchParams<{ courseId: string; lessonId: string }>();
  const { data: lesson, loading, error, reload } = useAsyncData(() => fetchLesson(lessonId), [lessonId]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (lesson) {
      setTitle(lesson.title);
      setDescription(lesson.description);
    }
  }, [lesson]);

  async function handleSave() {
    const result = validate(lessonSchema, { title });
    if (!result.success) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setFormError(null);
    setSaving(true);
    try {
      await updateLesson(lessonId, { title: result.data.title, description });
      router.back();
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    if (!lesson) return;
    Alert.alert('Excluir aula', `Excluir "${lesson.title}"? O vídeo enviado também será removido.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await deleteLesson(lessonId);
            if (lesson.video) {
              await videoProvider.remove(lesson.video.storage_path).catch(() => undefined);
            }
            router.back();
          } catch (err) {
            Alert.alert('Erro', getErrorMessage(err));
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  }

  if (loading) return <LoadingState />;
  if (error || !lesson) return <ErrorState message={error ?? 'Aula não encontrada.'} onRetry={reload} />;

  return (
    <Screen>
      <TopBar title="Editar aula" />

      {!!lesson.video && (
        <Badge
          label={
            lesson.video.status === 'ready'
              ? 'Vídeo pronto'
              : lesson.video.status === 'error'
                ? 'Erro no envio do vídeo'
                : 'Processando vídeo...'
          }
          tone={lesson.video.status === 'ready' ? 'success' : lesson.video.status === 'error' ? 'danger' : 'warning'}
        />
      )}

      <TextField label="Título da aula" value={title} onChangeText={setTitle} error={errors.title} />
      <TextField
        label="Descrição (opcional)"
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={4}
        style={styles.textarea}
      />

      {!!formError && <Text style={styles.formError}>{formError}</Text>}

      <Button label="Salvar alterações" onPress={handleSave} loading={saving} />
      <Button label="Excluir aula" variant="danger" onPress={handleDelete} loading={deleting} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  textarea: { minHeight: 96, textAlignVertical: 'top' },
  formError: { ...typography.caption, color: colors.danger },
});
