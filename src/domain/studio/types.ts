export type JobType =
  | 'transcription'
  | 'title_suggestion'
  | 'description_suggestion'
  | 'summary_suggestion'
  | 'chapter_suggestion'
  | 'cover_generation';

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type ProcessingJob = {
  id: string;
  account_id: string;
  course_id: string | null;
  lesson_id: string | null;
  video_id: string | null;
  job_type: JobType;
  status: JobStatus;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  error_message: string | null;
  attempts: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
};

export type TranscriptSegment = { start: number; end: number; text: string };

export type Transcription = {
  id: string;
  account_id: string;
  video_id: string;
  language: string | null;
  full_text: string | null;
  segments: TranscriptSegment[];
  status: 'pending' | 'processing' | 'ready' | 'error';
  error_message: string | null;
  visible_to_students: boolean;
};

export type CaptionPosition = 'top' | 'bottom' | 'optional' | 'off';

export type Caption = {
  id: string;
  video_id: string;
  transcription_id: string | null;
  position: CaptionPosition;
  vtt_content: string | null;
};

export type LessonChapter = {
  id: string;
  lesson_id: string;
  start_seconds: number;
  title: string;
  order_index: number;
  source: 'ai' | 'manual';
};

export type SuggestionType = 'title' | 'description' | 'summary' | 'key_points';

export type AiSuggestion = {
  id: string;
  account_id: string;
  target_type: 'lesson' | 'course';
  target_id: string;
  suggestion_type: SuggestionType;
  content: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
};

export type CourseCover = {
  id: string;
  course_id: string;
  storage_path: string;
  source: 'ai_generated' | 'uploaded';
  selected: boolean;
  created_at: string;
};

/** Everything the Savia Studio screen needs to show for a single lesson's readiness. */
export type LessonStudioStatus = {
  lessonId: string;
  lessonTitle: string;
  videoStatus: 'uploading' | 'processing' | 'ready' | 'error' | 'none';
  hasTranscription: boolean;
  hasCaptions: boolean;
  hasThumbnail: boolean;
  hasChapters: boolean;
  pendingSuggestions: number;
};
