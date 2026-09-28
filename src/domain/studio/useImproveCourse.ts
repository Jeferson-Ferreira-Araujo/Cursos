import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { LessonWithVideo } from '@/domain/lessons/types';
import { createAndRunJob, fetchCourseCovers, fetchPendingSuggestions } from './api';
import type { AiSuggestion } from './types';

export type ImproveStep = {
  key: string;
  label: string;
  status: 'pending' | 'running' | 'done' | 'error';
  detail?: string;
};

/**
 * Runs every Studio task a course is missing (transcription for lessons
 * without one, AI suggestions + chapters once a transcript exists, and a
 * cover if the course has none yet), one step at a time so the Creator sees
 * exactly what's happening. Nothing here applies a suggestion automatically
 * -- the caller is handed everything newly generated so it can be reviewed.
 */
export function useImproveCourse(accountId: string, courseId: string) {
  const [steps, setSteps] = useState<ImproveStep[]>([]);
  const [running, setRunning] = useState(false);
  const [newSuggestions, setNewSuggestions] = useState<AiSuggestion[]>([]);
  const [coverGenerated, setCoverGenerated] = useState(false);

  function updateStep(key: string, patch: Partial<ImproveStep>) {
    setSteps((current) => current.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  }

  async function run(lessons: LessonWithVideo[], courseHasCover: boolean) {
    setRunning(true);
    setNewSuggestions([]);
    setCoverGenerated(false);

    const initialSteps: ImproveStep[] = [
      { key: 'transcribe', label: 'Gerar legendas para as aulas', status: 'pending' },
      { key: 'suggestions', label: 'Gerar título, descrição e resumo', status: 'pending' },
      { key: 'chapters', label: 'Sugerir capítulos', status: 'pending' },
      { key: 'cover', label: 'Gerar capa do curso', status: 'pending' },
    ];
    setSteps(initialSteps);

    const lessonsWithVideo = lessons.filter((l) => l.video?.status === 'ready');

    // 1) Transcriptions for lessons that don't have one yet.
    updateStep('transcribe', { status: 'running' });
    let transcribedCount = 0;
    for (const lesson of lessonsWithVideo) {
      const { data: existing } = await supabase.from('transcriptions').select('status').eq('video_id', lesson.video_id!).maybeSingle();
      if (existing?.status === 'ready') continue;
      try {
        await createAndRunJob({ accountId, jobType: 'transcription', lessonId: lesson.id, videoId: lesson.video_id!, courseId });
        transcribedCount++;
      } catch {
        // Individual lesson failures don't stop the batch; the Creator can retry per lesson.
      }
    }
    updateStep('transcribe', { status: 'done', detail: `${transcribedCount} aula(s) transcritas` });

    // 2) Title/description/summary suggestions for lessons that now have a transcript.
    updateStep('suggestions', { status: 'running' });
    let suggestionCount = 0;
    for (const lesson of lessonsWithVideo) {
      const { data: transcription } = await supabase.from('transcriptions').select('status').eq('video_id', lesson.video_id!).maybeSingle();
      if (transcription?.status !== 'ready') continue;
      for (const jobType of ['title_suggestion', 'description_suggestion', 'summary_suggestion'] as const) {
        try {
          await createAndRunJob({ accountId, jobType, lessonId: lesson.id, videoId: lesson.video_id!, courseId });
          suggestionCount++;
        } catch {
          // Same as above -- keep going.
        }
      }
    }
    updateStep('suggestions', { status: 'done', detail: `${suggestionCount} sugestão(ões) geradas` });

    // 3) Chapters.
    updateStep('chapters', { status: 'running' });
    let chapterRuns = 0;
    for (const lesson of lessonsWithVideo) {
      const { data: transcription } = await supabase.from('transcriptions').select('status').eq('video_id', lesson.video_id!).maybeSingle();
      if (transcription?.status !== 'ready') continue;
      try {
        await createAndRunJob({ accountId, jobType: 'chapter_suggestion', lessonId: lesson.id, videoId: lesson.video_id!, courseId });
        chapterRuns++;
      } catch {
        // Same as above.
      }
    }
    updateStep('chapters', { status: 'done', detail: `${chapterRuns} aula(s) com capítulos sugeridos` });

    // 4) Cover, only if the course doesn't have one selected yet.
    if (!courseHasCover) {
      updateStep('cover', { status: 'running' });
      try {
        await createAndRunJob({ accountId, jobType: 'cover_generation', courseId });
        setCoverGenerated(true);
        updateStep('cover', { status: 'done', detail: '3 opções geradas' });
      } catch (err) {
        updateStep('cover', { status: 'error', detail: err instanceof Error ? err.message : 'Falhou' });
      }
    } else {
      updateStep('cover', { status: 'done', detail: 'Este curso já tem uma capa' });
    }

    // Gather everything generated in this run for the review screen.
    const lessonIds = lessons.map((l) => l.id);
    const allSuggestions = (
      await Promise.all(lessonIds.map((id) => fetchPendingSuggestions('lesson', id)))
    ).flat();
    setNewSuggestions(allSuggestions);

    setRunning(false);
  }

  return { steps, running, newSuggestions, coverGenerated, run, reload: () => fetchCourseCovers(courseId) };
}
