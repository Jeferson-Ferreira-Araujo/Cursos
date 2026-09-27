import { supabase } from '@/lib/supabase';
import type { LessonProgress, LessonProgressStatus } from './types';

export async function fetchCourseProgress(courseId: string, studentUserId: string): Promise<Record<string, LessonProgress>> {
  const { data, error } = await supabase
    .from('lesson_progress')
    .select('*')
    .eq('course_id', courseId)
    .eq('student_user_id', studentUserId);
  if (error) throw error;

  const byLessonId: Record<string, LessonProgress> = {};
  for (const row of data ?? []) {
    byLessonId[row.lesson_id] = row;
  }
  return byLessonId;
}

export async function saveLessonProgress(params: {
  accountId: string;
  courseId: string;
  lessonId: string;
  studentUserId: string;
  status: LessonProgressStatus;
  lastPositionSeconds: number;
}) {
  const { error } = await supabase.from('lesson_progress').upsert(
    {
      account_id: params.accountId,
      course_id: params.courseId,
      lesson_id: params.lessonId,
      student_user_id: params.studentUserId,
      status: params.status,
      last_position_seconds: params.lastPositionSeconds,
      completed_at: params.status === 'completed' ? new Date().toISOString() : null,
    },
    { onConflict: 'lesson_id,student_user_id' }
  );
  if (error) throw error;
}
