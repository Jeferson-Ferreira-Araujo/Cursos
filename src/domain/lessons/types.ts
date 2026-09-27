import type { VideoRecord } from '@/domain/videos/types';

export type Lesson = {
  id: string;
  account_id: string;
  course_id: string;
  video_id: string | null;
  title: string;
  description: string;
  order_index: number;
  created_at: string;
  updated_at: string;
};

export type LessonWithVideo = Lesson & {
  video: VideoRecord | null;
};
