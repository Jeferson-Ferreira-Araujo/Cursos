import { useMemo } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState, ProgressBar, Screen, TopBar } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';
import { useAuth } from '@/domain/auth/AuthContext';
import { useAsyncData } from '@/hooks/useAsyncData';
import { fetchCourse } from '@/domain/courses/api';
import { fetchLessons } from '@/domain/lessons/api';
import { acceptSuggestion, rejectSuggestion } from '@/domain/studio/api';
import { useImproveCourse, type ImproveStep, type ImproveStepKey } from '@/domain/studio/useImproveCourse';
import { getErrorMessage } from '@/utils/errors';

const INDIVIDUAL_ACTIONS: { key: ImproveStepKey; label: string }[] = [
  { key: 'transcribe', label: '✨ Gerar legendas' },
  { key: 'suggestions', label: '✨ Título, descrição e resumo' },
  { key: 'chapters', label: '✨ Sugerir capítulos' },
  { key: 'cover', label: '✨ Gerar capa' },
];

export default function CourseStudioScreen() {
  const { courseId } = useLocalSearchParams<{ courseId: string }>();
  const { account } = useAuth();

  const { data: course } = useAsyncData(() => fetchCourse(courseId), [courseId]);
  const { data: lessons, loading, error, refresh } = useAsyncData(() => fetchLessons(courseId), [courseId]);

  const { steps, running, newSuggestions, coverGenerated, runAll, runStep } = useImproveCourse(account!.id, courseId);

  const readyLessons = useMemo(() => (lessons ?? []).filter((l) => l.video?.status === 'ready'), [lessons]);

  function requireReadyLessons() {
    if (readyLessons.length === 0) {
      Alert.alert('Nenhuma aula pronta', 'Envie e aguarde pelo menos um vídeo terminar de processar antes de usar o Studio.');
      return false;
    }
    return true;
  }

  async function handleImproveCourse() {
    if (!requireReadyLessons()) return;
    await runAll(lessons ?? [], !!course?.cover_path);
  }

  async function handleRunStep(key: ImproveStepKey) {
    if (!requireReadyLessons()) return;
    await runStep(key, lessons ?? [], !!course?.cover_path);
  }

  async function handleAccept(suggestionId: string) {
    const suggestion = newSuggestions.find((s) => s.id === suggestionId);
    if (!suggestion) return;
    try {
      await acceptSuggestion(suggestion);
      await refresh();
    } catch (err) {
      Alert.alert('Erro', getErrorMessage(err));
    }
  }

  async function handleReject(suggestionId: string) {
    try {
      await rejectSuggestion(suggestionId);
    } catch (err) {
      Alert.alert('Erro', getErrorMessage(err));
    }
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;

  return (
    <Screen>
      <TopBar title="Savia Studio" />
      <Text style={styles.hint}>Deixe suas aulas prontas para ensinar.</Text>

      <Button label="✨ Melhorar meu curso (fazer tudo)" onPress={handleImproveCourse} loading={running} />

      <View style={styles.section}>
        <Text style={styles.label}>Ou escolha uma ação para rodar em todas as aulas</Text>
        <View style={styles.row}>
          {INDIVIDUAL_ACTIONS.map((action) => (
            <Button
              key={action.key}
              label={action.label}
              variant="secondary"
              fullWidth={false}
              disabled={running}
              onPress={() => handleRunStep(action.key)}
            />
          ))}
        </View>
      </View>

      {steps.length > 0 && (
        <Card style={styles.checklist}>
          {steps.map((step) => (
            <StepRow key={step.key} step={step} />
          ))}
        </Card>
      )}

      {coverGenerated && (
        <Button label="Ver opções de capa geradas" variant="secondary" onPress={() => router.push(`/(creator)/courses/${courseId}/cover`)} />
      )}

      {newSuggestions.length > 0 && (
        <View style={styles.section}>
          <Text style={typography.h3}>Revisar sugestões</Text>
          <Text style={styles.hint}>Você decide o que aplicar. Nada foi alterado ainda.</Text>
          {newSuggestions.map((suggestion) => (
            <Card key={suggestion.id} style={styles.suggestionCard}>
              <Text style={[styles.label, styles.capitalize]}>{suggestion.suggestion_type}</Text>
              <Text style={typography.body}>{suggestion.content}</Text>
              <View style={styles.row}>
                <Button label="Ignorar" variant="secondary" fullWidth={false} onPress={() => handleReject(suggestion.id)} />
                <Button label="Aceitar" fullWidth={false} onPress={() => handleAccept(suggestion.id)} />
              </View>
            </Card>
          ))}
        </View>
      )}

      <View style={styles.section}>
        <Text style={typography.h3}>Aulas</Text>
        {(lessons?.length ?? 0) === 0 && <EmptyState title="Nenhuma aula ainda" description="Envie vídeos no curso para usar o Studio." />}
        {(lessons ?? []).map((lesson) => (
          <Pressable key={lesson.id} onPress={() => router.push(`/(creator)/courses/${courseId}/lessons/${lesson.id}`)}>
            <Card style={styles.lessonRow}>
              <Text style={typography.bodyMedium} numberOfLines={1}>
                {lesson.title}
              </Text>
              <View style={styles.row}>
                <Badge
                  label={lesson.video?.status === 'ready' ? 'Vídeo pronto' : lesson.video?.status === 'error' ? 'Erro' : 'Processando'}
                  tone={lesson.video?.status === 'ready' ? 'success' : lesson.video?.status === 'error' ? 'danger' : 'warning'}
                />
              </View>
            </Card>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

function StepRow({ step }: { step: ImproveStep }) {
  const icon =
    step.status === 'done' ? 'checkmark-circle' : step.status === 'error' ? 'close-circle' : step.status === 'running' ? 'ellipsis-horizontal-circle' : 'ellipse-outline';
  const color = step.status === 'done' ? colors.success : step.status === 'error' ? colors.danger : step.status === 'running' ? colors.warning : colors.textMuted;

  // step.detail looks like "2/5" while running -- parse it into a real bar.
  const progressMatch = step.status === 'running' ? step.detail?.match(/^(\d+)\/(\d+)/) : null;
  const progress = progressMatch ? Number(progressMatch[1]) / Number(progressMatch[2]) : null;

  return (
    <View style={styles.stepRow}>
      <Ionicons name={icon} size={20} color={color} />
      <View style={styles.stepText}>
        <Text style={typography.body}>{step.label}</Text>
        {!!step.detail && <Text style={styles.hint}>{step.detail}</Text>}
        {progress !== null && (
          <View style={styles.stepProgressBar}>
            <ProgressBar progress={progress} />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hint: { ...typography.caption },
  checklist: { gap: spacing.sm },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepProgressBar: { marginTop: spacing.xs },
  stepText: { flex: 1 },
  section: { gap: spacing.sm },
  suggestionCard: { gap: spacing.xs, backgroundColor: colors.surfaceMuted },
  label: { ...typography.caption, color: colors.textSecondary },
  capitalize: { textTransform: 'capitalize' },
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  lessonRow: { gap: spacing.xs },
});
