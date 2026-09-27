import { supabase } from '@/lib/supabase';
import { countBy } from '@/utils/collections';
import type { Course, CourseStatus, CourseWithStats, StudentCourse } from './types';

export function getCoverPublicUrl(coverPath: string | null): string | null {
  if (!coverPath) return null;
  const { data } = supabase.storage.from('course-covers').getPublicUrl(coverPath);
  return data.publicUrl;
}

export async function fetchCreatorCourses(accountId: string): Promise<CourseWithStats[]> {
  const { data: courses, error } = await supabase
    .from('courses')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  if (!courses || courses.length === 0) return [];

  const courseIds = courses.map((c) => c.id);

  const [{ data: lessons, error: lessonsError }, { data: enrollments, error: enrollmentsError }] = await Promise.all([
    supabase.from('lessons').select('course_id').in('course_id', courseIds),
    supabase.from('enrollments').select('course_id').eq('status', 'active').in('course_id', courseIds),
  ]);
  if (lessonsError) throw lessonsError;
  if (enrollmentsError) throw enrollmentsError;

  const lessonCounts = countBy(lessons ?? [], (l) => l.course_id);
  const studentCounts = countBy(enrollments ?? [], (e) => e.course_id);

  return courses.map((course) => ({
    ...course,
    lesson_count: lessonCounts[course.id] ?? 0,
    student_count: studentCounts[course.id] ?? 0,
  }));
}

export async function fetchCourse(courseId: string): Promise<Course> {
  const { data, error } = await supabase.from('courses').select('*').eq('id', courseId).single();
  if (error) throw error;
  return data;
}

export async function createCourse(accountId: string, title: string, description: string, createdBy: string): Promise<Course> {
  const { data, error } = await supabase
    .from('courses')
    .insert({ account_id: accountId, title, description, created_by: createdBy })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCourse(
  courseId: string,
  patch: Partial<Pick<Course, 'title' | 'description' | 'cover_path'>>
) {
  const { error } = await supabase.from('courses').update(patch).eq('id', courseId);
  if (error) throw error;
}

export async function setCourseStatus(courseId: string, status: CourseStatus) {
  const { error } = await supabase.from('courses').update({ status }).eq('id', courseId);
  if (error) throw error;
}

export async function deleteCourse(courseId: string) {
  const { error } = await supabase.from('courses').delete().eq('id', courseId);
  if (error) throw error;
}

export async function uploadCourseCover(accountId: string, courseId: string, localUri: string, extension: string): Promise<string> {
  const path = `${accountId}/${courseId}/cover.${extension}`;
  const fileResponse = await fetch(localUri);
  const blob = await fileResponse.blob();
  const { error } = await supabase.storage.from('course-covers').upload(path, blob, {
    upsert: true,
    contentType: blob.type || `image/${extension}`,
  });
  if (error) throw error;
  return path;
}

/** Courses the current Student has active access to, with published-only enforced by RLS. */
export async function fetchStudentCourses(): Promise<StudentCourse[]> {
  const { data: enrollments, error } = await supabase
    .from('enrollments')
    .select('id, course:courses(*)')
    .eq('status', 'active');
  if (error) throw error;

  const withCourse = (enrollments ?? []).filter(
    (e): e is typeof e & { course: Course } => !!e.course
  );
  if (withCourse.length === 0) return [];

  const courseIds = withCourse.map((e) => e.course.id);

  const { data: { user } } = await supabase.auth.getUser();
  const studentId = user?.id;

  const [{ data: lessons, error: lessonsError }, { data: progress, error: progressError }] = await Promise.all([
    supabase.from('lessons').select('id, course_id').in('course_id', courseIds),
    studentId
      ? supabase
          .from('lesson_progress')
          .select('course_id')
          .eq('student_user_id', studentId)
          .eq('status', 'completed')
          .in('course_id', courseIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (lessonsError) throw lessonsError;
  if (progressError) throw progressError;

  const totalByCourse = countBy(lessons ?? [], (l) => l.course_id);
  const completedByCourse = countBy(progress ?? [], (p) => p.course_id);

  return withCourse.map((e) => ({
    ...e.course,
    enrollment_id: e.id,
    total_lessons: totalByCourse[e.course.id] ?? 0,
    completed_lessons: completedByCourse[e.course.id] ?? 0,
  }));
}
