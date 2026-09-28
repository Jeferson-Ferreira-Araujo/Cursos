import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, EmptyState, ErrorState, LoadingState, Screen, TopBar } from '@/components/ui';
import { colors, radius, spacing, typography } from '@/theme';
import { useAuth } from '@/domain/auth/AuthContext';
import { useAsyncData } from '@/hooks/useAsyncData';
import { uploadCourseCover } from '@/domain/courses/api';
import { createAndRunJob, fetchCourseCovers, getCoverCandidateUrl, selectCourseCover } from '@/domain/studio/api';
import { supabase } from '@/lib/supabase';
import { getErrorMessage } from '@/utils/errors';

export default function CourseCoverScreen() {
  const { courseId } = useLocalSearchParams<{ courseId: string }>();
  const { account } = useAuth();
  const { data: covers, loading, error, refresh } = useAsyncData(() => fetchCourseCovers(courseId), [courseId]);

  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectingId, setSelectingId] = useState<string | null>(null);

  async function handleGenerate() {
    setGenerating(true);
    try {
      await createAndRunJob({ accountId: account!.id, jobType: 'cover_generation', courseId });
      await refresh();
    } catch (err) {
      Alert.alert('Erro', getErrorMessage(err));
    } finally {
      setGenerating(false);
    }
  }

  async function handleUploadManual() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permissão necessária', 'Permita o acesso às fotos para escolher uma capa.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [16, 9] });
    if (result.canceled || !result.assets[0]) return;

    setUploading(true);
    try {
      const extension = result.assets[0].uri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const path = await uploadCourseCover(account!.id, courseId, result.assets[0].uri, extension);
      const { error: insertError } = await supabase.from('course_covers').insert({ account_id: account!.id, course_id: courseId, storage_path: path, source: 'uploaded' });
      if (insertError) throw insertError;
      await refresh();
    } catch (err) {
      Alert.alert('Erro', getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  function handleSelect(coverId: string) {
    const cover = (covers ?? []).find((c) => c.id === coverId);
    if (!cover) return;
    Alert.alert('Usar esta capa?', 'Isso substitui a capa atual do curso.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Usar capa',
        onPress: async () => {
          setSelectingId(coverId);
          try {
            await selectCourseCover(courseId, cover);
            await refresh();
            router.back();
          } catch (err) {
            Alert.alert('Erro', getErrorMessage(err));
          } finally {
            setSelectingId(null);
          }
        },
      },
    ]);
  }

  return (
    <Screen>
      <TopBar title="Gerar capa" />
      <Text style={styles.hint}>Crie opções de capa com IA a partir do nome e da descrição do curso, ou envie uma imagem sua.</Text>

      <View style={styles.actions}>
        <Button label="✨ Gerar capa" onPress={handleGenerate} loading={generating} fullWidth={false} />
        <Button label="Enviar imagem manual" variant="secondary" onPress={handleUploadManual} loading={uploading} fullWidth={false} />
      </View>

      {loading && <LoadingState />}
      {!!error && <ErrorState message={error} onRetry={refresh} />}
      {!loading && !error && (covers?.length ?? 0) === 0 && (
        <EmptyState title="Nenhuma opção de capa ainda" description="Gere opções com IA ou envie uma imagem." />
      )}

      <View style={styles.grid}>
        {(covers ?? []).map((cover) => (
          <Pressable key={cover.id} style={styles.gridItem} onPress={() => handleSelect(cover.id)} disabled={selectingId === cover.id}>
            <Card style={styles.coverCard}>
              <Image source={{ uri: getCoverCandidateUrl(cover.storage_path) }} style={styles.coverImage} contentFit="cover" />
              {cover.selected && (
                <View style={styles.selectedBadge}>
                  <Ionicons name="checkmark-circle" size={22} color={colors.success} />
                </View>
              )}
            </Card>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { ...typography.caption },
  actions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  gridItem: { width: '47%' },
  coverCard: { padding: 0, overflow: 'hidden', aspectRatio: 16 / 9 },
  coverImage: { width: '100%', height: '100%', borderRadius: radius.lg },
  selectedBadge: { position: 'absolute', top: spacing.xs, right: spacing.xs, backgroundColor: colors.surface, borderRadius: radius.pill },
});
