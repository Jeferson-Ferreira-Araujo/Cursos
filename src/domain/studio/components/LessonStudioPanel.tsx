import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Badge, Button, Card, LoadingState, TextField } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors, radius, spacing, typography } from '@/theme';
import { formatDuration } from '@/utils/format';
import { getErrorMessage } from '@/utils/errors';
import type { LessonWithVideo } from '@/domain/lessons/types';
import { updateLesson } from '@/domain/lessons/api';
import { CaptionPositionPicker } from './CaptionPositionPicker';
import { useLessonStudioData } from '../useLessonStudioData';
import {
  acceptSuggestion,
  createAndRunJob,
  deleteLessonChapter,
  getThumbnailUrl,
  rejectSuggestion,
  setCaptionPosition,
  setLessonThumbnail,
  setTranscriptVisibility,
  uploadLessonThumbnail,
} from '../api';
import type { AiSuggestion } from '../types';

const SUGGESTION_LABELS: Record<AiSuggestion['suggestion_type'], string> = {
  title: 'Título sugerido',
  description: 'Descrição sugerida',
  summary: 'Resumo sugerido',
  key_points: 'Principais pontos',
};

export function LessonStudioPanel({ accountId, lesson, onLessonUpdated }: { accountId: string; lesson: LessonWithVideo; onLessonUpdated: () => void }) {
  const videoId = lesson.video_id;
  const videoReady = lesson.video?.status === 'ready';
  const { transcription, caption, chapters, suggestions, refreshAll } = useLessonStudioData(lesson.id, videoId);

  const [runningJob, setRunningJob] = useState<string | null>(null);
  const [editingTranscript, setEditingTranscript] = useState(false);
  const [transcriptDraft, setTranscriptDraft] = useState('');
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);

  const hasTranscription = transcription.data?.status === 'ready';

  async function runJob(key: string, jobType: Parameters<typeof createAndRunJob>[0]['jobType']) {
    if (!videoId) return;
    setRunningJob(key);
    try {
      await createAndRunJob({ accountId, jobType, lessonId: lesson.id, videoId, courseId: lesson.course_id });
      await refreshAll();
    } catch (err) {
      Alert.alert('Erro', getErrorMessage(err));
    } finally {
      setRunningJob(null);
    }
  }

  async function handleTogglePosition(position: Parameters<typeof setCaptionPosition>[1]) {
    if (!videoId) return;
    try {
      await setCaptionPosition(videoId, position);
      await caption.refresh();
    } catch (err) {
      Alert.alert('Erro', getErrorMessage(err));
    }
  }

  async function handleToggleVisibility() {
    if (!videoId || !transcription.data) return;
    try {
      await setTranscriptVisibility(videoId, !transcription.data.visible_to_students);
      await transcription.refresh();
    } catch (err) {
      Alert.alert('Erro', getErrorMessage(err));
    }
  }

  async function handleSaveTranscript() {
    if (!videoId) return;
    try {
      const { error } = await supabase.from('transcriptions').update({ full_text: transcriptDraft }).eq('video_id', videoId);
      if (error) throw error;
      setEditingTranscript(false);
      await transcription.refresh();
    } catch (err) {
      Alert.alert('Erro', getErrorMessage(err));
    }
  }

  async function handleAccept(suggestion: AiSuggestion) {
    try {
      await acceptSuggestion(suggestion);
      await suggestions.refresh();
      onLessonUpdated();
    } catch (err) {
      Alert.alert('Erro', getErrorMessage(err));
    }
  }

  async function handleReject(suggestionId: string) {
    try {
      await rejectSuggestion(suggestionId);
      await suggestions.refresh();
    } catch (err) {
      Alert.alert('Erro', getErrorMessage(err));
    }
  }

  async function handleDeleteChapter(chapterId: string) {
    try {
      await deleteLessonChapter(chapterId);
      await chapters.refresh();
    } catch (err) {
      Alert.alert('Erro', getErrorMessage(err));
    }
  }

  async function handlePickThumbnail() {
    if (!videoId) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permissão necessária', 'Permita o acesso às fotos para escolher uma imagem.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [16, 9] });
    if (result.canceled || !result.assets[0]) return;

    setUploadingThumbnail(true);
    try {
      const path = await uploadLessonThumbnail(accountId, videoId, result.assets[0].uri);
      await setLessonThumbnail(videoId, path);
      onLessonUpdated();
    } catch (err) {
      Alert.alert('Erro', getErrorMessage(err));
    } finally {
      setUploadingThumbnail(false);
    }
  }

  const thumbnailUrl = getThumbnailUrl(lesson.video?.thumbnail_path ?? null);

  return (
    <Card style={styles.card}>
      <Text style={typography.h3}>Savia Studio</Text>
      <Text style={styles.hint}>Deixe esta aula pronta para ensinar.</Text>

      {!videoReady && <Text style={styles.hint}>Aguarde o vídeo terminar de processar para usar as melhorias.</Text>}

      {videoReady && (
        <>
          {/* Thumbnail */}
          <View style={styles.section}>
            <Text style={typography.bodyMedium}>Miniatura</Text>
            <View style={styles.thumbnailRow}>
              <View style={styles.thumbnailPreview}>
                {thumbnailUrl ? (
                  <Image source={{ uri: thumbnailUrl }} style={styles.thumbnailImage} contentFit="cover" />
                ) : (
                  <Ionicons name="image-outline" size={22} color={colors.textMuted} />
                )}
              </View>
              <Button label="Enviar imagem manual" variant="secondary" fullWidth={false} loading={uploadingThumbnail} onPress={handlePickThumbnail} />
            </View>
          </View>

          {/* Legendas / Transcrição */}
          <View style={styles.section}>
            <Text style={typography.bodyMedium}>Legendas e transcrição</Text>
            {transcription.loading && <LoadingState label="Carregando..." />}
            {!hasTranscription && (
              <Button
                label="✨ Gerar legendas"
                variant="secondary"
                loading={runningJob === 'transcription'}
                onPress={() => runJob('transcription', 'transcription')}
              />
            )}
            {!!transcription.data?.status && transcription.data.status !== 'ready' && (
              <Badge label={transcription.data.status === 'processing' ? 'Gerando...' : 'Falhou'} tone={transcription.data.status === 'processing' ? 'warning' : 'danger'} />
            )}
            {hasTranscription && (
              <>
                <Badge label="Transcrição pronta" tone="success" />
                <Text style={styles.label}>Posição da legenda no player</Text>
                <CaptionPositionPicker value={caption.data?.position ?? 'off'} onChange={handleTogglePosition} />

                <Pressable style={styles.checkboxRow} onPress={handleToggleVisibility}>
                  <Ionicons
                    name={transcription.data?.visible_to_students ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={transcription.data?.visible_to_students ? colors.primary : colors.textMuted}
                  />
                  <Text style={styles.label}>Mostrar transcrição completa para o aluno</Text>
                </Pressable>

                {editingTranscript ? (
                  <>
                    <TextField label="Transcrição" value={transcriptDraft} onChangeText={setTranscriptDraft} multiline numberOfLines={6} style={styles.textarea} />
                    <View style={styles.row}>
                      <Button label="Cancelar" variant="secondary" fullWidth={false} onPress={() => setEditingTranscript(false)} />
                      <Button label="Salvar correção" fullWidth={false} onPress={handleSaveTranscript} />
                    </View>
                  </>
                ) : (
                  <Pressable
                    onPress={() => {
                      setTranscriptDraft(transcription.data?.full_text ?? '');
                      setEditingTranscript(true);
                    }}
                  >
                    <Text style={styles.transcriptPreview} numberOfLines={3}>
                      {transcription.data?.full_text || 'Sem texto.'}
                    </Text>
                    <Text style={styles.editLink}>Toque para corrigir o texto</Text>
                  </Pressable>
                )}

                <Button label="Gerar novamente" variant="ghost" fullWidth={false} loading={runningJob === 'transcription'} onPress={() => runJob('transcription', 'transcription')} />
              </>
            )}
          </View>

          {/* Sugestões de IA */}
          <View style={styles.section}>
            <Text style={typography.bodyMedium}>Sugestões da IA</Text>
            {!hasTranscription && <Text style={styles.hint}>Gere as legendas primeiro para liberar as sugestões.</Text>}
            {hasTranscription && (
              <View style={styles.row}>
                <Button label="✨ Título" variant="secondary" fullWidth={false} loading={runningJob === 'title'} onPress={() => runJob('title', 'title_suggestion')} />
                <Button label="✨ Descrição" variant="secondary" fullWidth={false} loading={runningJob === 'description'} onPress={() => runJob('description', 'description_suggestion')} />
                <Button label="✨ Resumo" variant="secondary" fullWidth={false} loading={runningJob === 'summary'} onPress={() => runJob('summary', 'summary_suggestion')} />
              </View>
            )}
            {(suggestions.data ?? []).map((suggestion) => (
              <Card key={suggestion.id} style={styles.suggestionCard}>
                <Text style={styles.label}>{SUGGESTION_LABELS[suggestion.suggestion_type]}</Text>
                <Text style={typography.body}>{suggestion.content}</Text>
                <View style={styles.row}>
                  <Button label="Ignorar" variant="secondary" fullWidth={false} onPress={() => handleReject(suggestion.id)} />
                  <Button label="Aceitar" fullWidth={false} onPress={() => handleAccept(suggestion)} />
                </View>
              </Card>
            ))}
          </View>

          {/* Capítulos */}
          <View style={styles.section}>
            <Text style={typography.bodyMedium}>Capítulos</Text>
            {!hasTranscription && <Text style={styles.hint}>Gere as legendas primeiro para sugerir capítulos.</Text>}
            {hasTranscription && (
              <Button label="✨ Gerar capítulos" variant="secondary" fullWidth={false} loading={runningJob === 'chapters'} onPress={() => runJob('chapters', 'chapter_suggestion')} />
            )}
            {(chapters.data ?? []).map((chapter) => (
              <View key={chapter.id} style={styles.chapterRow}>
                <Text style={styles.label}>{formatDuration(chapter.start_seconds)}</Text>
                <Text style={[typography.body, styles.chapterTitle]} numberOfLines={1}>
                  {chapter.title}
                </Text>
                <Pressable onPress={() => handleDeleteChapter(chapter.id)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={18} color={colors.danger} />
                </Pressable>
              </View>
            ))}
          </View>
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  hint: { ...typography.caption },
  section: { gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  label: { ...typography.caption, color: colors.textSecondary },
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  transcriptPreview: { ...typography.body },
  editLink: { ...typography.small, color: colors.primary },
  textarea: { minHeight: 120, textAlignVertical: 'top' },
  suggestionCard: { gap: spacing.xs, backgroundColor: colors.surfaceMuted },
  chapterRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  chapterTitle: { flex: 1 },
  thumbnailRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  thumbnailPreview: { width: 72, height: 40, borderRadius: radius.sm, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  thumbnailImage: { width: '100%', height: '100%' },
});
