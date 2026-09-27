export type VideoStatus = 'uploading' | 'processing' | 'ready' | 'error';

export type VideoRecord = {
  id: string;
  account_id: string;
  provider: string;
  storage_path: string;
  original_filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  duration_seconds: number | null;
  status: VideoStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type VideoUploadInput = {
  accountId: string;
  courseId: string;
  localUri: string;
  filename: string;
  mimeType: string;
  onProgress?: (fraction: number) => void;
};

export type VideoUploadResult = {
  videoId: string;
  storagePath: string;
};

/**
 * Abstraction over "where the actual video bytes live and how playback URLs
 * are obtained". The Supabase Storage implementation below can be swapped
 * for a dedicated streaming/transcoding provider later without touching the
 * courses/lessons domain or any screen.
 */
export interface VideoProvider {
  upload(input: VideoUploadInput): Promise<VideoUploadResult>;
  getPlaybackUrl(storagePath: string): Promise<string>;
  remove(storagePath: string): Promise<void>;
}
