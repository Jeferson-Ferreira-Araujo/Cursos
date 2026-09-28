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
 * cover if the course has none yet). Nothing here applies a suggestion
 * automatically -- the caller is handed everything newly generated so it
 * can be reviewed.
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

  /**
   * Runs `tasks` with limited concurrency (each one a real network
   * round-trip through an Edge Function, so doing them one at a time is
   * what made "Título, descrição e resumo" across several lessons feel like
   * it hung -- but firing them all at once overloads the phone's connection
   * and Supabase starts rejecting requests with "Failed to send a request
   * to the Edge Function"). Reports live "x/y" progress as tasks settle.
   */
  async function runParallel(stepKey: ImproveStepKey, tasks: (() => Promise<void>)[], concurrency = 3) {
    updateStep(stepKey, { status: 'running', detail: tasks.length > 0 ? `0/${tasks.length}` : undefined });
    let settledCount = 0;
    let okCount = 0;
    let firstError: string | null = null;
    let nextIndex = 0;

    async function worker() {
      while (nextIndex < tasks.length) {
        const task = tasks[nextIndex++];
        try {
          await task();
          okCount++;
        } catch (err) {
          if (!firstError) firstError = err instanceof Error ? err.message : 'Falha desconhecida.';
        } finally {
          settledCount++;
          updateStep(stepKey, { detail: `${settledCount}/${tasks.length}` });
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));

    return { okCount, totalCount: tasks.length, firstError };
  }

  async function runTranscribeStep(lessons: LessonWithVideo[]) {
    const candidates: LessonWithVideo[] = [];
    for (const lesson of readyLessonsOf(lessons)) {
      const { data: existing } = await supabase.from('transcriptions').select('status').eq('video_id', lesson.video_id!).maybeSingle();
      if (existing?.status !== 'ready') candidates.push(lesson);
    }

    const { okCount, totalCount, firstError } = await runParallel(
      'transcribe',
      candidates.map((lesson) => async () => {
        await createAndRunJob({ accountId, jobType: 'transcription', lessonId: lesson.id, videoId: lesson.video_id!, courseId });
      })
    );

    const detail =
      firstError && okCount === 0
        ? `0 transcrita(s). ${firstError}`
        : firstError
          ? `${okCount}/${totalCount} transcrita(s). Uma falhou: ${firstError}`
          : `${okCount} aula(s) transcritas`;
    updateStep('transcribe', { status: firstError && okCount === 0 ? 'error' : 'done', detail });
  }

  async function runSuggestionsStep(lessons: LessonWithVideo[]) {
    const candidates: LessonWithVideo[] = [];
    for (const lesson of readyLessonsOf(lessons)) {
      const { data: transcription } = await supabase.from('transcriptions').select('status').eq('video_id', lesson.video_id!).maybeSingle();
      if (transcription?.status === 'ready') candidates.push(lesson);
    }

    const tasks = candidates.flatMap((lesson) =>
      (['title_suggestion', 'description_suggestion', 'summary_suggestion'] as const).map((jobType) => async () => {
        await createAndRunJob({ accountId, jobType, lessonId: lesson.id, videoId: lesson.video_id!, courseId });
      })
    );

    const { okCount, totalCount, firstError } = await runParallel('suggestions', tasks);

    const detail =
      firstError && okCount === 0
        ? `0 geradas. ${firstError}`
        : firstError
          ? `${okCount}/${totalCount} geradas. Uma falhou: ${firstError}`
          : `${okCount} sugestão(ões) geradas`;
    updateStep('suggestions', { status: firstError && okCount === 0 ? 'error' : 'done', detail });

    const lessonIds = lessons.map((l) => l.id);
    const allSuggestions = (await Promise.all(lessonIds.map((id) => fetchPendingSuggestions('lesson', id)))).flat();
    setNewSuggestions(allSuggestions);
  }

  async function runChaptersStep(lessons: LessonWithVideo[]) {
    const candidates: LessonWithVideo[] = [];
    for (const lesson of readyLessonsOf(lessons)) {
      const { data: transcription } = await supabase.from('transcriptions').select('status').eq('video_id', lesson.video_id!).maybeSingle();
      if (transcription?.status === 'ready') candidates.push(lesson);
    }

    const { okCount, totalCount, firstError } = await runParallel(
      'chapters',
      candidates.map((lesson) => async () => {
        await createAndRunJob({ accountId, jobType: 'chapter_suggestion', lessonId: lesson.id, videoId: lesson.video_id!, courseId });
      })
    );

    const detail =
      firstError && okCount === 0
        ? `0 aula(s). ${firstError}`
        : firstError
          ? `${okCount}/${totalCount} aula(s). Uma falhou: ${firstError}`
          : `${okCount} aula(s) com capítulos sugeridos`;
    updateStep('chapters', { status: firstError && okCount === 0 ? 'error' : 'done', detail });
  }

  async function runCoverStep(courseHasCover: boolean, force: boolean) {
    if (courseHasCover && !force) {
      updateStep('cover', { status: 'done', detail: 'Este curso já tem uma capa' });
      return;
    }
    updateStep('cover', { status: 'running' });
    try {
      await createAndRunJob(
        { accountId, jobType: 'cover_generation', courseId },
        (job) => {
          const output = job.output as { generated?: number; total?: number } | null;
          if (output?.generated != null && output?.total) {
            updateStep('cover', { detail: `${output.generated}/${output.total} imagens` });
          }
        }
      );
      setCoverGenerated(true);
      updateStep('cover', { status: 'done', detail: 'Capa gerada' });
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
