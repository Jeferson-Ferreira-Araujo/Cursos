import { supabase } from '@/lib/supabase';
import type { Lesson, LessonWithVideo } from './types';

export async function fetchLessons(courseId: string): Promise<LessonWithVideo[]> {
  const { data, error } = await supabase
    .from('lessons')
    .select('*, video:videos(*)')
    .eq('course_id', courseId)
    .order('order_index', { ascending: true });
  if (error) throw error;
  return data as unknown as LessonWithVideo[];
}

export async function fetchLesson(lessonId: string): Promise<LessonWithVideo> {
  const { data, error } = await supabase
    .from('lessons')
    .select('*, video:videos(*)')
    .eq('id', lessonId)
    .single();
  if (error) throw error;
  return data as unknown as LessonWithVideo;
}

export async function createLesson(params: {
  accountId: string;
  courseId: string;
  title: string;
  description?: string;
  videoId?: string | null;
  orderIndex: number;
}): Promise<Lesson> {
  const { data, error } = await supabase
    .from('lessons')
    .insert({
      account_id: params.accountId,
      course_id: params.courseId,
      title: params.title,
      description: params.description ?? '',
      video_id: params.videoId ?? null,
      order_index: params.orderIndex,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateLesson(lessonId: string, patch: Partial<Pick<Lesson, 'title' | 'description' | 'video_id'>>) {
  const { error } = await supabase.from('lessons').update(patch).eq('id', lessonId);
  if (error) throw error;
}

export async function deleteLesson(lessonId: string) {
  const { error } = await supabase.from('lessons').delete().eq('id', lessonId);
  if (error) throw error;
}

/** Persists a new lesson order. `orderedLessonIds` must be every lesson id of the course, in the desired order. */
export async function reorderLessons(orderedLessonIds: string[]) {
  await Promise.all(
    orderedLessonIds.map((lessonId, index) =>
      supabase.from('lessons').update({ order_index: index }).eq('id', lessonId).then(({ error }) => {
        if (error) throw error;
      })
    )
  );
}

export async function nextOrderIndex(courseId: string): Promise<number> {
  const { count, error } = await supabase
    .from('lessons')
    .select('id', { count: 'exact', head: true })
    .eq('course_id', courseId);
  if (error) throw error;
  return count ?? 0;
}
