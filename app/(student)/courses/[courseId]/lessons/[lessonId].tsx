import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { Button, ErrorState, LoadingState, Screen, TopBar } from '@/components/ui';
import { colors, radius, spacing, typography } from '@/theme';
import { useAuth } from '@/domain/auth/AuthContext';
import { useAsyncData } from '@/hooks/useAsyncData';
import { fetchLesson, fetchLessons } from '@/domain/lessons/api';
import { fetchCourseProgress, saveLessonProgress } from '@/domain/progress/api';
import { videoProvider } from '@/domain/videos';
import { fetchCaption, fetchLessonChapters, fetchTranscription } from '@/domain/studio/api';
import { formatDuration } from '@/utils/format';
import { getErrorMessage } from '@/utils/errors';

const PROGRESS_SAVE_INTERVAL_SECONDS = 5;

export default function LessonPlayerScreen() {
  const { courseId, lessonId } = useLocalSearchParams<{ courseId: string; lessonId: string }>();
  const { session, account } = useAuth();
  const studentId = session!.user.id;
  const accountIdRef = useRef<string | null>(null);

  const { data: lesson, loading: loadingLesson, error: lessonError } = useAsyncData(() => fetchLesson(lessonId), [lessonId]);
  const { data: allLessons } = useAsyncData(() => fetchLessons(courseId), [courseId]);
  const { data: progress, refresh: refreshProgress } = useAsyncData(
    () => fetchCourseProgress(courseId, studentId),
    [courseId, studentId]
  );
  const videoId = lesson?.video_id ?? null;
  const { data: caption } = useAsyncData(() => (videoId ? fetchCaption(videoId) : Promise.resolve(null)), [videoId]);
  const { data: transcription } = useAsyncData(() => (videoId ? fetchTranscription(videoId) : Promise.resolve(null)), [videoId]);
  const { data: chapters } = useAsyncData(() => fetchLessonChapters(lessonId), [lessonId]);

  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [showCompletedCelebration, setShowCompletedCelebration] = useState(false);
  const [captionsVisible, setCaptionsVisible] = useState(true);
  const [currentCaptionText, setCurrentCaptionText] = useState('');
  const hasSeekedRef = useRef(false);

  useEffect(() => {
    accountIdRef.current = lesson?.account_id ?? account?.id ?? null;
  }, [lesson, account]);

  useEffect(() => {
    let cancelled = false;
    hasSeekedRef.current = false;
    setPlaybackUrl(null);
    setPlaybackError(null);

    if (lesson?.video?.status === 'ready') {
      videoProvider
        .getPlaybackUrl(lesson.video.storage_path)
        .then((url) => {
          if (!cancelled) setPlaybackUrl(url);
        })
        .catch((err) => {
          if (!cancelled) setPlaybackError(getErrorMessage(err));
        });
    }
    return () => {
      cancelled = true;
    };
  }, [lesson?.video?.storage_path, lesson?.video?.status]);

  const player = useVideoPlayer(null, (p) => {
    p.timeUpdateEventInterval = PROGRESS_SAVE_INTERVAL_SECONDS;
  });

  useEffect(() => {
    if (playbackUrl) {
      player.replace(playbackUrl);
    }
  }, [playbackUrl, player]);

  const savedPosition = progress?.[lessonId]?.last_position_seconds ?? 0;
  const isCompleted = progress?.[lessonId]?.status === 'completed';

  useEventListener(player, 'statusChange', ({ status }) => {
    if (status === 'readyToPlay' && !hasSeekedRef.current) {
      hasSeekedRef.current = true;
      if (savedPosition > 1) player.currentTime = savedPosition;
      player.play();
    }
  });

  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    if (!lesson || !accountIdRef.current || isCompleted) return;
    saveLessonProgress({
      accountId: accountIdRef.current,
      courseId,
      lessonId,
      studentUserId: studentId,
      status: 'in_progress',
      lastPositionSeconds: Math.floor(currentTime),
    }).catch(() => undefined);
  });

  useEventListener(player, 'playToEnd', () => {
    handleMarkCompleted();
  });

  const captionsEnabled = caption?.position && caption.position !== 'off';

  // Lightweight local polling for the on-screen caption text -- separate
  // from the 5s progress-save interval above so the subtitle stays in sync
  // without writing to the database more often than needed.
  useEffect(() => {
    if (!captionsEnabled || !transcription?.segments?.length) {
      setCurrentCaptionText('');
      return;
    }
    const interval = setInterval(() => {
      const time = player.currentTime;
      const segment = transcription.segments.find((s) => time >= s.start && time <= s.end);
      setCurrentCaptionText(segment?.text ?? '');
    }, 400);
    return () => clearInterval(interval);
  }, [captionsEnabled, transcription, player]);

  const { previousLesson, nextLesson } = useMemo(() => {
    const list = allLessons ?? [];
    const index = list.findIndex((l) => l.id === lessonId);
    return {
      previousLesson: index > 0 ? list[index - 1] : null,
      nextLesson: index >= 0 && index < list.length - 1 ? list[index + 1] : null,
    };
  }, [allLessons, lessonId]);

  async function handleMarkCompleted() {
    if (!lesson || !accountIdRef.current || completing) return;
    setCompleting(true);
    try {
      await saveLessonProgress({
        accountId: accountIdRef.current,
        courseId,
        lessonId,
        studentUserId: studentId,
        status: 'completed',
        lastPositionSeconds: Math.floor(player.currentTime),
      });
      await refreshProgress();

      const isLastLesson = !nextLesson;
      const allOthersCompleted = (allLessons ?? []).every(
        (l) => l.id === lessonId || progress?.[l.id]?.status === 'completed'
      );
      if (isLastLesson && allOthersCompleted) {
        setShowCompletedCelebration(true);
      } else if (nextLesson) {
        router.replace(`/(student)/courses/${courseId}/lessons/${nextLesson.id}`);
      }
    } catch {
      // saveLessonProgress errors are non-fatal to the viewing experience.
    } finally {
      setCompleting(false);
    }
  }

  if (loadingLesson) return <LoadingState />;
  if (lessonError || !lesson) return <ErrorState message={lessonError ?? 'Aula não encontrada.'} />;

  if (showCompletedCelebration) {
    return (
      <Screen>
        <View style={styles.celebration}>
          <Ionicons name="checkmark-circle" size={72} color={colors.success} />
          <Text style={typography.h1}>Parabéns!</Text>
          <Text style={styles.celebrationText}>Você concluiu este curso.</Text>
          <Button label="Voltar para meus cursos" onPress={() => router.replace('/(student)')} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <TopBar title={lesson.title} onBack={() => router.replace(`/(student)/courses/${courseId}`)} />

      <View style={styles.playerWrapper}>
        {lesson.video?.status !== 'ready' ? (
          <View style={styles.playerPlaceholder}>
            <Text style={styles.placeholderText}>
              {lesson.video?.status === 'error' ? 'Houve um erro no envio deste vídeo.' : 'Vídeo ainda sendo processado...'}
            </Text>
          </View>
        ) : playbackError ? (
          <View style={styles.playerPlaceholder}>
            <Text style={styles.placeholderText}>{playbackError}</Text>
          </View>
        ) : (
          <>
            <VideoView player={player} style={styles.player} contentFit="contain" allowsFullscreen nativeControls />
            {captionsEnabled && captionsVisible && !!currentCaptionText && (
              <View style={[styles.captionBox, caption?.position === 'top' ? styles.captionTop : styles.captionBottom]}>
                <Text style={styles.captionText}>{currentCaptionText}</Text>
              </View>
            )}
            {caption?.position === 'optional' && (
              <View style={styles.ccButtonWrapper}>
                <Button
                  label={captionsVisible ? 'CC ✓' : 'CC'}
                  variant="secondary"
                  fullWidth={false}
                  onPress={() => setCaptionsVisible((v) => !v)}
                />
              </View>
            )}
          </>
        )}
      </View>

      {(chapters?.length ?? 0) > 0 && (
        <View style={styles.chaptersSection}>
          <Text style={typography.bodyMedium}>Capítulos</Text>
          {chapters!.map((chapter) => (
            <Button
              key={chapter.id}
              label={`${formatDuration(chapter.start_seconds)}  ${chapter.title}`}
              variant="ghost"
              onPress={() => {
                player.currentTime = chapter.start_seconds;
                player.play();
              }}
            />
          ))}
        </View>
      )}

      {transcription?.visible_to_students && !!transcription.full_text && (
        <View style={styles.transcriptSection}>
          <Text style={typography.bodyMedium}>Transcrição</Text>
          <Text style={styles.transcriptText}>{transcription.full_text}</Text>
        </View>
      )}

      <View style={styles.controls}>
        <View style={styles.navRow}>
          <Button
            label="Aula anterior"
            variant="secondary"
            fullWidth={false}
            disabled={!previousLesson}
            onPress={() => previousLesson && router.replace(`/(student)/courses/${courseId}/lessons/${previousLesson.id}`)}
          />
          <Button
            label="Próxima aula"
            variant="secondary"
            fullWidth={false}
            disabled={!nextLesson}
            onPress={() => nextLesson && router.replace(`/(student)/courses/${courseId}/lessons/${nextLesson.id}`)}
          />
        </View>
        <Button
          label={isCompleted ? 'Aula concluída' : 'Marcar como concluída'}
          onPress={handleMarkCompleted}
          loading={completing}
          disabled={isCompleted}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  playerWrapper: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000', borderRadius: radius.md, overflow: 'hidden' },
  player: { width: '100%', height: '100%' },
  playerPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  placeholderText: { color: colors.textInverse, textAlign: 'center' },
  captionBox: { position: 'absolute', left: spacing.md, right: spacing.md, alignItems: 'center' },
  captionTop: { top: spacing.md },
  captionBottom: { bottom: spacing.md },
  ccButtonWrapper: { position: 'absolute', bottom: spacing.sm, right: spacing.sm },
  captionText: {
    color: colors.textInverse,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    textAlign: 'center',
    fontSize: 13,
  },
  chaptersSection: { gap: spacing.xs },
  transcriptSection: { gap: spacing.xs },
  transcriptText: { ...typography.body, color: colors.textSecondary },
  controls: { padding: spacing.lg, gap: spacing.md },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  celebration: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xl },
  celebrationText: { ...typography.body, textAlign: 'center' },
});
