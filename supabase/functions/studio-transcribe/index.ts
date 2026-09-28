// Transcribes a lesson's video via Groq's Whisper API and stores the
// transcript + an auto-generated caption track. Runs entirely server-side:
// the Groq key never reaches the client.
//
// Self-contained on purpose (no imports from a sibling _shared/ folder):
// keeps each Studio function an independent deployable unit.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');
// Groq's free tier caps uploads at 25MB -- documented and enforced here so
// a Creator gets a clear message instead of a confusing provider error.
const MAX_FILE_BYTES = 25 * 1024 * 1024;

type TranscriptSegment = { start: number; end: number; text: string };

function segmentsToVtt(segments: TranscriptSegment[]): string {
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  const toVttTimestamp = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const millis = Math.round((totalSeconds - Math.floor(totalSeconds)) * 1000);
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${pad(millis, 3)}`;
  };
  const lines = ['WEBVTT', ''];
  segments.forEach((segment, index) => {
    lines.push(String(index + 1), `${toVttTimestamp(segment.start)} --> ${toVttTimestamp(segment.end)}`, segment.text.trim(), '');
  });
  return lines.join('\n');
}

async function markProcessing(adminClient: SupabaseClient, jobId: string) {
  await adminClient.from('video_processing_jobs').update({ status: 'processing', started_at: new Date().toISOString() }).eq('id', jobId);
}
async function markCompleted(adminClient: SupabaseClient, jobId: string, output: Record<string, unknown>) {
  await adminClient.from('video_processing_jobs').update({ status: 'completed', output, completed_at: new Date().toISOString() }).eq('id', jobId);
}
async function markFailed(adminClient: SupabaseClient, jobId: string, message: string) {
  const { data: current } = await adminClient.from('video_processing_jobs').select('attempts').eq('id', jobId).single();
  await adminClient
    .from('video_processing_jobs')
    .update({ status: 'failed', error_message: message, completed_at: new Date().toISOString(), attempts: ((current?.attempts as number) ?? 0) + 1 })
    .eq('id', jobId);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonResponse({ error: 'Missing Authorization header' }, 401);

  let jobId: string;
  try {
    ({ job_id: jobId } = await req.json());
  } catch {
    return jsonResponse({ error: 'Invalid request body, expected { job_id }' }, 400);
  }
  if (!jobId) return jsonResponse({ error: 'job_id is required' }, 400);

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  // RLS-scoped read: if this doesn't come back, the caller doesn't own the job.
  const { data: job, error: jobError } = await userClient.from('video_processing_jobs').select('*').eq('id', jobId).single();
  if (jobError || !job) return jsonResponse({ error: 'Job not found or not authorized' }, 404);
  if (job.job_type !== 'transcription') return jsonResponse({ error: 'Job is not a transcription job' }, 400);
  if (!job.video_id) return jsonResponse({ error: 'Job has no video_id' }, 400);

  await markProcessing(adminClient, jobId);

  try {
    if (!GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY não está configurada nos secrets do projeto Supabase. Peça ao administrador para configurá-la.');
    }

    const { data: video, error: videoError } = await adminClient.from('videos').select('storage_path, original_filename').eq('id', job.video_id).single();
    if (videoError || !video) throw new Error('Vídeo não encontrado.');

    const { data: fileBlob, error: downloadError } = await adminClient.storage.from('lesson-videos').download(video.storage_path);
    if (downloadError || !fileBlob) throw new Error('Não foi possível baixar o vídeo para transcrição.');

    if (fileBlob.size > MAX_FILE_BYTES) {
      throw new Error(
        `Vídeo muito grande para transcrição no plano gratuito (${(fileBlob.size / 1024 / 1024).toFixed(1)}MB, máximo 25MB). Tente um arquivo menor ou de menor duração.`
      );
    }

    // Groq infers the audio/video format from the filename's extension, not
    // the blob's mime type -- a filename with no (or the wrong) extension
    // gets rejected as "unsupported_audio_format" even for a valid mp4.
    const extensionMatch = (video.original_filename || video.storage_path).match(/\.([a-zA-Z0-9]+)$/);
    const extension = extensionMatch ? extensionMatch[1].toLowerCase() : 'mp4';

    const formData = new FormData();
    formData.append('file', fileBlob, `lesson-video.${extension}`);
    formData.append('model', 'whisper-large-v3-turbo');
    formData.append('response_format', 'verbose_json');

    const groqResponse = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
      body: formData,
    });
    if (!groqResponse.ok) {
      const errorBody = await groqResponse.text();
      throw new Error(`Falha na transcrição (Groq): ${groqResponse.status} ${errorBody.slice(0, 300)}`);
    }

    const result = await groqResponse.json();
    const segments: TranscriptSegment[] = (result.segments ?? []).map((s: { start: number; end: number; text: string }) => ({
      start: s.start,
      end: s.end,
      text: s.text,
    }));
    const fullText: string = result.text ?? segments.map((s) => s.text).join(' ');
    const language: string = result.language ?? 'pt';
    const durationSeconds: number = result.duration ?? segments.at(-1)?.end ?? 0;

    const { data: transcription, error: upsertError } = await adminClient
      .from('transcriptions')
      .upsert(
        { account_id: job.account_id, video_id: job.video_id, language, full_text: fullText, segments, status: 'ready', error_message: null },
        { onConflict: 'video_id' }
      )
      .select()
      .single();
    if (upsertError || !transcription) throw new Error('Falha ao salvar a transcrição.');

    await adminClient
      .from('captions')
      .upsert(
        { account_id: job.account_id, video_id: job.video_id, transcription_id: transcription.id, vtt_content: segmentsToVtt(segments) },
        { onConflict: 'video_id' }
      );

    await adminClient.from('ai_usage_events').insert({ account_id: job.account_id, job_id: jobId, usage_type: 'transcription_seconds', quantity: durationSeconds });
    await markCompleted(adminClient, jobId, { transcription_id: transcription.id, duration_seconds: durationSeconds });

    return jsonResponse({ transcription_id: transcription.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido na transcrição.';
    await markFailed(adminClient, jobId, message);
    return jsonResponse({ error: message }, 500);
  }
});
