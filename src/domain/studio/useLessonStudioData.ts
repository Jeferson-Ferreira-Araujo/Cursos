import { useAsyncData } from '@/hooks/useAsyncData';
import { fetchCaption, fetchLessonChapters, fetchPendingSuggestions, fetchTranscription } from './api';

export function useLessonStudioData(lessonId: string, videoId: string | null) {
  const transcription = useAsyncData(() => (videoId ? fetchTranscription(videoId) : Promise.resolve(null)), [videoId]);
  const caption = useAsyncData(() => (videoId ? fetchCaption(videoId) : Promise.resolve(null)), [videoId]);
  const chapters = useAsyncData(() => fetchLessonChapters(lessonId), [lessonId]);
  const suggestions = useAsyncData(() => fetchPendingSuggestions('lesson', lessonId), [lessonId]);

  async function refreshAll() {
    await Promise.all([transcription.refresh(), caption.refresh(), chapters.refresh(), suggestions.refresh()]);
  }

  return { transcription, caption, chapters, suggestions, refreshAll };
}
