import * as Crypto from 'expo-crypto';
import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';
import type { VideoProvider, VideoUploadInput, VideoUploadResult } from './types';

const BUCKET = 'lesson-videos';

async function getAccessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sessão expirada. Faça login novamente.');
  return token;
}

/** XMLHttpRequest is used instead of fetch solely because it exposes real upload progress events. */
function uploadWithProgress(
  url: string,
  body: Blob,
  headers: Record<string, string>,
  onProgress?: (fraction: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    for (const [key, value] of Object.entries(headers)) {
      xhr.setRequestHeader(key, value);
    }
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(event.loaded / event.total);
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Falha no envio do vídeo (${xhr.status}): ${xhr.responseText}`));
      }
    };
    xhr.onerror = () => reject(new Error('Erro de rede durante o envio do vídeo.'));
    xhr.send(body);
  });
}

function sanitizeFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export const supabaseStorageVideoProvider: VideoProvider = {
  async upload({ accountId, courseId, localUri, filename, mimeType, onProgress }: VideoUploadInput): Promise<VideoUploadResult> {
    const videoId = Crypto.randomUUID();
    const storagePath = `${accountId}/${courseId}/${videoId}/${sanitizeFilename(filename)}`;

    const { error: insertError } = await supabase.from('videos').insert({
      id: videoId,
      account_id: accountId,
      storage_path: storagePath,
      original_filename: filename,
      mime_type: mimeType,
      status: 'uploading',
    });
    if (insertError) throw insertError;

    try {
      const fileResponse = await fetch(localUri);
      const blob = await fileResponse.blob();
      const token = await getAccessToken();
      const uploadUrl = `${env.supabaseUrl}/storage/v1/object/${BUCKET}/${storagePath}`;

      await uploadWithProgress(
        uploadUrl,
        blob,
        {
          Authorization: `Bearer ${token}`,
          apikey: env.supabasePublishableKey,
          'content-type': mimeType,
          'x-upsert': 'false',
          'cache-control': 'max-age=3600',
        },
        onProgress
      );

      await supabase.from('videos').update({ status: 'ready', size_bytes: blob.size }).eq('id', videoId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido no envio.';
      await supabase.from('videos').update({ status: 'error', error_message: message }).eq('id', videoId);
      throw err;
    }

    return { videoId, storagePath };
  },

  async getPlaybackUrl(storagePath: string): Promise<string> {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 60 * 60);
    if (error) throw error;
    return data.signedUrl;
  },

  async remove(storagePath: string): Promise<void> {
    const { error } = await supabase.storage.from(BUCKET).remove([storagePath]);
    if (error) throw error;
  },
};
