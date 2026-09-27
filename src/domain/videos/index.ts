import { supabaseStorageVideoProvider } from './SupabaseStorageVideoProvider';
import type { VideoProvider } from './types';

// Single point to swap the video backend later (e.g. Mux, Cloudflare Stream).
export const videoProvider: VideoProvider = supabaseStorageVideoProvider;

export * from './types';
