import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, ErrorState, LoadingState, Screen, TextField, TopBar } from '@/components/ui';
import { colors, radius, spacing, typography } from '@/theme';
import { useAuth } from '@/domain/auth/AuthContext';
import { useAsyncData } from '@/hooks/useAsyncData';
import { fetchCourse, getCoverPublicUrl, updateCourse, uploadCourseCover } from '@/domain/courses/api';
import { courseSchema, validate } from '@/utils/validation';
import { getErrorMessage } from '@/utils/errors';

export default function EditCourseScreen() {
  const { courseId } = useLocalSearchParams<{ courseId: string }>();
  const { account } = useAuth();
  const { data: course, loading, error, reload } = useAsyncData(() => fetchCourse(courseId), [courseId]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  useEffect(() => {
    if (course) {
      setTitle(course.title);
      setDescription(course.description);
      setCoverUrl(getCoverPublicUrl(course.cover_path));
    }
  }, [course]);

  async function handlePickCover() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permissão necessária', 'Permita o acesso às fotos para escolher uma capa.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [16, 9],
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const extension = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
    setUploadingCover(true);
    try {
      const path = await uploadCourseCover(account!.id, courseId, asset.uri, extension);
      await updateCourse(courseId, { cover_path: path });
      setCoverUrl(getCoverPublicUrl(path) + `?t=${Date.now()}`);
    } catch (err) {
      Alert.alert('Erro ao enviar capa', getErrorMessage(err));
    } finally {
      setUploadingCover(false);
    }
  }

  async function handleSave() {
    const result = validate(courseSchema, { title, description });
    if (!result.success) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setFormError(null);
    setSaving(true);
    try {
      await updateCourse(courseId, { title: result.data.title, description: result.data.description });
      router.back();
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState />;
  if (error || !course) return <ErrorState message={error ?? 'Curso não encontrado.'} onRetry={reload} />;

  return (
    <Screen>
      <TopBar title="Editar curso" />

      <Pressable style={styles.coverPicker} onPress={handlePickCover} disabled={uploadingCover}>
        {coverUrl ? (
          <Image source={{ uri: coverUrl }} style={styles.coverImage} contentFit="cover" />
        ) : (
          <View style={styles.coverPlaceholder}>
            <Ionicons name="image-outline" size={28} color={colors.textMuted} />
          </View>
        )}
        <View style={styles.coverOverlay}>
          <Ionicons name="camera" size={16} color={colors.textInverse} />
          <Text style={styles.coverOverlayText}>{uploadingCover ? 'Enviando...' : 'Alterar capa'}</Text>
        </View>
      </Pressable>

      <TextField label="Nome do curso" value={title} onChangeText={setTitle} error={errors.title} />
      <TextField
        label="Descrição"
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={4}
        style={styles.textarea}
      />

      {!!formError && <Text style={styles.formError}>{formError}</Text>}

      <Button label="Salvar alterações" onPress={handleSave} loading={saving} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  coverPicker: { height: 160, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surfaceMuted },
  coverImage: { width: '100%', height: '100%' },
  coverPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  coverOverlay: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
    backgroundColor: 'rgba(20,20,43,0.7)',
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  coverOverlayText: { color: colors.textInverse, fontSize: 12, fontWeight: '600' },
  textarea: { minHeight: 96, textAlignVertical: 'top', paddingTop: spacing.md },
  formError: { ...typography.caption, color: colors.danger },
});
