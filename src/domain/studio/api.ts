import { supabase } from '@/lib/supabase';
import type {
  AiSuggestion,
  Caption,
  CaptionPosition,
  CourseCover,
  JobType,
  LessonChapter,
  ProcessingJob,
  Transcription,
} from './types';

const EDGE_FUNCTION_BY_JOB_TYPE: Record<JobType, string> = {
  transcription: 'studio-transcribe',
  title_suggestion: 'studio-suggest',
  description_suggestion: 'studio-suggest',
  summary_suggestion: 'studio-suggest',
  chapter_suggestion: 'studio-suggest',
  cover_generation: 'studio-generate-cover',
};

/**
 * Creates the job row (RLS-checked insert) then invokes the Edge Function
 * that actually does the work. The function runs to completion server-side
 * even if the app is closed right after this call returns -- the job row is
 * always the source of truth for status, not the fetch response.
 *
 * `onProgress` is polled from the job row while the request is in flight
 * (some jobs, like cover generation, write incremental `{generated, total}`
 * progress into `output` as they go) so the caller can show something better
 * than a single indefinite spinner for a call that can take a minute.
 */
export async function createAndRunJob(
  params: {
    accountId: string;
    jobType: JobType;
    courseId?: string;
    lessonId?: string;
    videoId?: string;
  },
  onProgress?: (job: ProcessingJob) => void
): Promise<ProcessingJob> {
  const { data: job, error } = await supabase
    .from('video_processing_jobs')
    .insert({
      account_id: params.accountId,
      job_type: params.jobType,
      course_id: params.courseId ?? null,
      lesson_id: params.lessonId ?? null,
      video_id: params.videoId ?? null,
    })
    .select()
    .single();
  if (error || !job) throw error ?? new Error('Falha ao criar tarefa.');

  const pollInterval = onProgress
    ? setInterval(() => {
        fetchJob(job.id)
          .then(onProgress)
          .catch(() => undefined);
      }, 1500)
    : null;

  try {
    const functionName = EDGE_FUNCTION_BY_JOB_TYPE[params.jobType];
    const { error: invokeError } = await supabase.functions.invoke(functionName, { body: { job_id: job.id } });
    if (invokeError) {
      // supabase-js only surfaces "non-2xx status code" here; the real,
      // human-readable message is whatever the function wrote to the job row.
      const failedJob = await fetchJob(job.id).catch(() => null);
      throw new Error(failedJob?.error_message || invokeError.message);
    }
  } finally {
    if (pollInterval) clearInterval(pollInterval);
  }

  return job;
}

export async function fetchJob(jobId: string): Promise<ProcessingJob> {
  const { data, error } = await supabase.from('video_processing_jobs').select('*').eq('id', jobId).single();
  if (error) throw error;
  return data;
}

export async function fetchTranscription(videoId: string): Promise<Transcription | null> {
  const { data, error } = await supabase.from('transcriptions').select('*').eq('video_id', videoId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function setTranscriptVisibility(videoId: string, visible: boolean) {
  const { error } = await supabase.from('transcriptions').update({ visible_to_students: visible }).eq('video_id', videoId);
  if (error) throw error;
}

export async function fetchCaption(videoId: string): Promise<Caption | null> {
  const { data, error } = await supabase.from('captions').select('*').eq('video_id', videoId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function setCaptionPosition(videoId: string, position: CaptionPosition) {
  const { error } = await supabase.from('captions').update({ position }).eq('video_id', videoId);
  if (error) throw error;
}

export async function fetchLessonChapters(lessonId: string): Promise<LessonChapter[]> {
  const { data, error } = await supabase
    .from('lesson_chapters')
    .select('*')
    .eq('lesson_id', lessonId)
    .order('order_index', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function deleteLessonChapter(chapterId: string) {
  const { error } = await supabase.from('lesson_chapters').delete().eq('id', chapterId);
  if (error) throw error;
}

export async function fetchPendingSuggestions(targetType: 'lesson' | 'course', targetId: string): Promise<AiSuggestion[]> {
  const { data, error } = await supabase
    .from('ai_suggestions')
    .select('*')
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function acceptSuggestion(suggestion: AiSuggestion) {
  if (suggestion.suggestion_type === 'title' || suggestion.suggestion_type === 'description') {
    const column = suggestion.suggestion_type; // 'title' | 'description'
    const { error: applyError } = await supabase.from('lessons').update({ [column]: suggestion.content }).eq('id', suggestion.target_id);
    if (applyError) throw applyError;
  }
  const { error } = await supabase
    .from('ai_suggestions')
    .update({ status: 'accepted', applied_at: new Date().toISOString() })
    .eq('id', suggestion.id);
  if (error) throw error;
}

export async function rejectSuggestion(suggestionId: string) {
  const { error } = await supabase.from('ai_suggestions').update({ status: 'rejected' }).eq('id', suggestionId);
  if (error) throw error;
}

export async function fetchCourseCovers(courseId: string): Promise<CourseCover[]> {
  const { data, error } = await supabase
    .from('course_covers')
    .select('*')
    .eq('course_id', courseId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Selects a candidate cover and mirrors it onto courses.cover_path -- never done silently by a job. */
export async function selectCourseCover(courseId: string, cover: CourseCover) {
  const { error: clearError } = await supabase.from('course_covers').update({ selected: false }).eq('course_id', courseId);
  if (clearError) throw clearError;

  const { error: selectError } = await supabase.from('course_covers').update({ selected: true }).eq('id', cover.id);
  if (selectError) throw selectError;

  const { error: courseError } = await supabase.from('courses').update({ cover_path: cover.storage_path }).eq('id', courseId);
  if (courseError) throw courseError;
}

export function getCoverCandidateUrl(storagePath: string): string {
  const { data } = supabase.storage.from('course-covers').getPublicUrl(storagePath);
  return data.publicUrl;
}

export async function setLessonThumbnail(videoId: string, thumbnailPath: string) {
  const { error } = await supabase.from('videos').update({ thumbnail_path: thumbnailPath }).eq('id', videoId);
  if (error) throw error;
}

export function getThumbnailUrl(thumbnailPath: string | null): string | null {
  if (!thumbnailPath) return null;
  const { data } = supabase.storage.from('lesson-thumbnails').getPublicUrl(thumbnailPath);
  return data.publicUrl;
}

export async function uploadLessonThumbnail(accountId: string, videoId: string, localUri: string): Promise<string> {
  const path = `${accountId}/${videoId}.jpg`;
  const fileResponse = await fetch(localUri);
  const blob = await fileResponse.blob();
  const { error } = await supabase.storage.from('lesson-thumbnails').upload(path, blob, {
    upsert: true,
    contentType: 'image/jpeg',
  });
  if (error) throw error;
  return path;
}
