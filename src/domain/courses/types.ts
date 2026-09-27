export type CourseStatus = 'draft' | 'published';

export type Course = {
  id: string;
  account_id: string;
  title: string;
  description: string;
  cover_path: string | null;
  status: CourseStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CourseWithStats = Course & {
  lesson_count: number;
  student_count: number;
};

export type StudentCourse = Course & {
  enrollment_id: string;
  total_lessons: number;
  completed_lessons: number;
};
