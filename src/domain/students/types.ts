export type InvitationStatus = 'pending' | 'accepted';
export type EnrollmentStatus = 'active' | 'revoked';

export type Invitation = {
  id: string;
  account_id: string;
  email: string;
  full_name: string;
  user_id: string | null;
  invited_by: string | null;
  status: InvitationStatus;
  created_at: string;
  accepted_at: string | null;
};

export type Enrollment = {
  id: string;
  account_id: string;
  course_id: string;
  invitation_id: string;
  status: EnrollmentStatus;
  granted_by: string | null;
  created_at: string;
  revoked_at: string | null;
};

export type EnrollmentWithCourse = Enrollment & {
  course_title: string;
  total_lessons: number;
  completed_lessons: number;
};

export type StudentWithEnrollments = Invitation & {
  enrollments: EnrollmentWithCourse[];
};
