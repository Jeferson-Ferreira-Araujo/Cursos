import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { LessonWithVideo } from '@/domain/lessons/types';
import { createAndRunJob, fetchCourseCovers, fetchPendingSuggestions } from './api';
import type { AiSuggestion } from './types';

export type ImproveStepKey = 'transcribe' | 'suggestions' | 'chapters' | 'cover';

export type ImproveStep = {
  key: ImproveStepKey;
  label: string;
  status: 'pending' | 'running' | 'done' | 'error';
  detail?: string;
};

const STEP_LABELS: Record<ImproveStepKey, string> = {
  transcribe: 'Gerar legendas para as aulas',
  suggestions: 'Gerar título, descrição e resumo',
  chapters: 'Sugerir capítulos',
  cover: 'Gerar capa do curso',
};

function readyLessonsOf(lessons: LessonWithVideo[]) {
  return lessons.filter((l) => l.video?.status === 'ready');
}

/**
 * Runs every Studio task a course is missing (transcription for lessons
 * without one, AI suggestions + chapters once a transcript exists, and a
 * cover if the course has none yet), one step at a time so the Creator sees
 * exactly what's happening. Nothing here applies a suggestion automatically
 * -- the caller is handed everything newly generated so it can be reviewed.
 *
 * Each step can also be run on its own (`runStep`) for a Creator who wants
 * to, say, only regenerate covers without re-touching transcriptions.
 */
export function useImproveCourse(accountId: string, courseId: string) {
  const [steps, setSteps] = useState<ImproveStep[]>([]);
  const [running, setRunning] = useState(false);
  const [newSuggestions, setNewSuggestions] = useState<AiSuggestion[]>([]);
  const [coverGenerated, setCoverGenerated] = useState(false);

  function updateStep(key: ImproveStepKey, patch: Partial<ImproveStep>) {
    setSteps((current) => current.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  }

  async function runTranscribeStep(lessons: LessonWithVideo[]) {
    updateStep('transcribe', { status: 'running' });
    let doneCount = 0;
    const errors: string[] = [];
    for (const lesson of readyLessonsOf(lessons)) {
      const { data: existing } = await supabase.from('transcriptions').select('status').eq('video_id', lesson.video_id!).maybeSingle();
      if (existing?.status === 'ready') continue;
      try {
        await createAndRunJob({ accountId, jobType: 'transcription', lessonId: lesson.id, videoId: lesson.video_id!, courseId });
        doneCount++;
      } catch (err) {
        errors.push(err instanceof Error ? err.message : 'Falha desconhecida.');
      }
    }
    const detail = errors.length > 0 ? `${doneCount} transcrita(s), ${errors.length} falharam: ${errors[0]}` : `${doneCount} aula(s) transcritas`;
    updateStep('transcribe', { status: errors.length > 0 && doneCount === 0 ? 'error' : 'done', detail });
  }

  async function runSuggestionsStep(lessons: LessonWithVideo[]) {
    updateStep('suggestions', { status: 'running' });
    let doneCount = 0;
    const errors: string[] = [];
    for (const lesson of readyLessonsOf(lessons)) {
      const { data: transcription } = await supabase.from('transcriptions').select('status').eq('video_id', lesson.video_id!).maybeSingle();
      if (transcription?.status !== 'ready') continue;
      for (const jobType of ['title_suggestion', 'description_suggestion', 'summary_suggestion'] as const) {
        try {
          await createAndRunJob({ accountId, jobType, lessonId: lesson.id, videoId: lesson.video_id!, courseId });
          doneCount++;
        } catch (err) {
          errors.push(err instanceof Error ? err.message : 'Falha desconhecida.');
        }
      }
    }
    const detail = errors.length > 0 ? `${doneCount} gerada(s), ${errors.length} falharam: ${errors[0]}` : `${doneCount} sugestão(ões) geradas`;
    updateStep('suggestions', { status: errors.length > 0 && doneCount === 0 ? 'error' : 'done', detail });

    const lessonIds = lessons.map((l) => l.id);
    const allSuggestions = (await Promise.all(lessonIds.map((id) => fetchPendingSuggestions('lesson', id)))).flat();
    setNewSuggestions(allSuggestions);
  }

  async function runChaptersStep(lessons: LessonWithVideo[]) {
    updateStep('chapters', { status: 'running' });
    let doneCount = 0;
    const errors: string[] = [];
    for (const lesson of readyLessonsOf(lessons)) {
      const { data: transcription } = await supabase.from('transcriptions').select('status').eq('video_id', lesson.video_id!).maybeSingle();
      if (transcription?.status !== 'ready') continue;
      try {
        await createAndRunJob({ accountId, jobType: 'chapter_suggestion', lessonId: lesson.id, videoId: lesson.video_id!, courseId });
        doneCount++;
      } catch (err) {
        errors.push(err instanceof Error ? err.message : 'Falha desconhecida.');
      }
    }
    const detail = errors.length > 0 ? `${doneCount} aula(s), ${errors.length} falharam: ${errors[0]}` : `${doneCount} aula(s) com capítulos sugeridos`;
    updateStep('chapters', { status: errors.length > 0 && doneCount === 0 ? 'error' : 'done', detail });
  }

  async function runCoverStep(courseHasCover: boolean, force: boolean) {
    if (courseHasCover && !force) {
      updateStep('cover', { status: 'done', detail: 'Este curso já tem uma capa' });
      return;
    }
    updateStep('cover', { status: 'running' });
    try {
      await createAndRunJob({ accountId, jobType: 'cover_generation', courseId });
      setCoverGenerated(true);
      updateStep('cover', { status: 'done', detail: '3 opções geradas' });
    } catch (err) {
      updateStep('cover', { status: 'error', detail: err instanceof Error ? err.message : 'Falhou' });
    }
  }

  /** Runs a single step in isolation (the Creator picked one specific action). */
  async function runStep(key: ImproveStepKey, lessons: LessonWithVideo[], courseHasCover: boolean) {
    setRunning(true);
    setSteps([{ key, label: STEP_LABELS[key], status: 'pending' }]);
    if (key === 'transcribe') await runTranscribeStep(lessons);
    else if (key === 'suggestions') await runSuggestionsStep(lessons);
    else if (key === 'chapters') await runChaptersStep(lessons);
    else if (key === 'cover') await runCoverStep(courseHasCover, true);
    setRunning(false);
  }

  /** Runs everything the course is missing, in order -- the "✨ Melhorar meu curso" shortcut. */
  async function runAll(lessons: LessonWithVideo[], courseHasCover: boolean) {
    setRunning(true);
    setNewSuggestions([]);
    setCoverGenerated(false);
    setSteps((['transcribe', 'suggestions', 'chapters', 'cover'] as ImproveStepKey[]).map((key) => ({ key, label: STEP_LABELS[key], status: 'pending' })));

    await runTranscribeStep(lessons);
    await runSuggestionsStep(lessons);
    await runChaptersStep(lessons);
    await runCoverStep(courseHasCover, false);

    setRunning(false);
  }

  return { steps, running, newSuggestions, coverGenerated, runAll, runStep, reload: () => fetchCourseCovers(courseId) };
}
