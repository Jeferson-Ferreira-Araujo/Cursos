export type LessonProgressStatus = 'not_started' | 'in_progress' | 'completed';

export type LessonProgress = {
  id: string;
  account_id: string;
  course_id: string;
  lesson_id: string;
  student_user_id: string;
  status: LessonProgressStatus;
  last_position_seconds: number;
  completed_at: string | null;
  updated_at: string;
};
