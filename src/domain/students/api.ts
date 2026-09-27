import { supabase } from '@/lib/supabase';
import { countBy } from '@/utils/collections';
import type { EnrollmentWithCourse, Invitation, StudentWithEnrollments } from './types';

export async function addStudent(accountId: string, email: string, fullName: string): Promise<Invitation> {
  const { data, error } = await supabase.rpc('add_student', {
    p_account_id: accountId,
    p_email: email,
    p_full_name: fullName,
  });
  if (error) throw error;
  return data as Invitation;
}

export async function grantCourseAccess(courseId: string, invitationId: string) {
  const { error } = await supabase.rpc('grant_course_access', {
    p_course_id: courseId,
    p_invitation_id: invitationId,
  });
  if (error) throw error;
}

export async function revokeCourseAccess(enrollmentId: string) {
  const { error } = await supabase.rpc('revoke_course_access', { p_enrollment_id: enrollmentId });
  if (error) throw error;
}

export async function fetchStudents(accountId: string): Promise<StudentWithEnrollments[]> {
  const { data: invitations, error: invitationsError } = await supabase
    .from('invitations')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false });
  if (invitationsError) throw invitationsError;
  if (!invitations || invitations.length === 0) return [];

  const { data: enrollments, error: enrollmentsError } = await supabase
    .from('enrollments')
    .select('*, course:courses(id, title)')
    .eq('account_id', accountId);
  if (enrollmentsError) throw enrollmentsError;

  const courseIds = [...new Set((enrollments ?? []).map((e) => e.course_id))];

  const [{ data: lessons, error: lessonsError }, { data: progress, error: progressError }] = await Promise.all([
    courseIds.length
      ? supabase.from('lessons').select('id, course_id').in('course_id', courseIds)
      : Promise.resolve({ data: [], error: null }),
    courseIds.length
      ? supabase.from('lesson_progress').select('course_id, student_user_id').eq('status', 'completed').in('course_id', courseIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (lessonsError) throw lessonsError;
  if (progressError) throw progressError;

  const totalLessonsByCourse = countBy(lessons ?? [], (l) => l.course_id);

  const enrollmentsByInvitation = new Map<string, EnrollmentWithCourse[]>();
  for (const e of enrollments ?? []) {
    const invitation = invitations.find((i) => i.id === e.invitation_id);
    const completed = (progress ?? []).filter(
      (p) => p.course_id === e.course_id && p.student_user_id === invitation?.user_id
    ).length;

    const list = enrollmentsByInvitation.get(e.invitation_id) ?? [];
    list.push({
      ...e,
      course_title: (e as { course?: { title?: string } }).course?.title ?? '',
      total_lessons: totalLessonsByCourse[e.course_id] ?? 0,
      completed_lessons: completed,
    });
    enrollmentsByInvitation.set(e.invitation_id, list);
  }

  return invitations.map((invitation) => ({
    ...invitation,
    enrollments: enrollmentsByInvitation.get(invitation.id) ?? [],
  }));
}

export async function fetchStudent(invitationId: string): Promise<StudentWithEnrollments> {
  const { data: invitation, error } = await supabase.from('invitations').select('*').eq('id', invitationId).single();
  if (error) throw error;

  const students = await fetchStudents(invitation.account_id);
  const found = students.find((s) => s.id === invitationId);
  return found ?? { ...invitation, enrollments: [] };
}
