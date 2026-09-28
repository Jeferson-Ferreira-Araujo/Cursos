// Generates a few course cover candidates via Pollinations.ai (free, no API
// key) from the course title/description. The Creator picks one afterwards
// -- nothing here overwrites courses.cover_path directly.
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
const CANDIDATE_COUNT = 3;

function buildPrompt(title: string, description: string): string {
  const base = `Capa de curso online sobre "${title}". ${description}`.trim();
  return (
    `${base}. Estilo moderno e minimalista, cores vibrantes com tons de azul e roxo, ` +
    'ilustração digital limpa, composição centralizada, sem texto, sem pessoas realistas, proporção 16:9.'
  );
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

  const { data: job, error: jobError } = await userClient.from('video_processing_jobs').select('*').eq('id', jobId).single();
  if (jobError || !job) return jsonResponse({ error: 'Job not found or not authorized' }, 404);
  if (!job.course_id) return jsonResponse({ error: 'Job has no course_id' }, 400);

  await markProcessing(adminClient, jobId);

  try {
    const { data: course, error: courseError } = await adminClient.from('courses').select('id, title, description').eq('id', job.course_id).single();
    if (courseError || !course) throw new Error('Curso não encontrado.');

    const prompt = buildPrompt(course.title, course.description ?? '');

    // Generated in parallel: each candidate is independent, and Pollinations
    // can take 10-40s per image -- running them one at a time made this step
    // feel stuck for well over a minute with a single generic spinner.
    let completedCount = 0;
    const generateOne = async (): Promise<string> => {
      const seed = Math.floor(Math.random() * 1_000_000);
      const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=576&seed=${seed}&nologo=true`;

      // Pollinations occasionally returns a transient 5xx under load -- one
      // retry clears most of those instead of failing the whole batch.
      let imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        imageResponse = await fetch(imageUrl);
      }
      if (!imageResponse.ok) throw new Error(`Falha ao gerar imagem de capa (Pollinations): ${imageResponse.status}`);
      const imageBytes = await imageResponse.arrayBuffer();
      const storagePath = `${job.account_id}/${job.course_id}/ai-cover-${seed}.jpg`;

      const { error: uploadError } = await adminClient.storage.from('course-covers').upload(storagePath, imageBytes, { contentType: 'image/jpeg', upsert: true });
      if (uploadError) throw new Error('Falha ao salvar imagem de capa gerada.');

      const { data: coverRow, error: insertError } = await adminClient
        .from('course_covers')
        .insert({ account_id: job.account_id, course_id: job.course_id, storage_path: storagePath, source: 'ai_generated', prompt })
        .select()
        .single();
      if (insertError || !coverRow) throw new Error('Falha ao registrar a capa gerada.');

      completedCount++;
      // Best-effort progress ping the client can poll for -- ignored if it fails.
      adminClient
        .from('video_processing_jobs')
        .update({ output: { generated: completedCount, total: CANDIDATE_COUNT } })
        .eq('id', jobId)
        .then(() => undefined);

      return coverRow.id;
    };

    const results = await Promise.allSettled(Array.from({ length: CANDIDATE_COUNT }, generateOne));
    const coverIds = results.filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled').map((r) => r.value);
    if (coverIds.length === 0) {
      const firstError = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
      throw firstError?.reason instanceof Error ? firstError.reason : new Error('Falha ao gerar as capas.');
    }

    await adminClient.from('ai_usage_events').insert({ account_id: job.account_id, job_id: jobId, usage_type: 'image_generation', quantity: coverIds.length });
    await markCompleted(adminClient, jobId, { cover_ids: coverIds, generated: coverIds.length, total: CANDIDATE_COUNT });

    return jsonResponse({ cover_ids: coverIds });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido ao gerar capa.';
    await markFailed(adminClient, jobId, message);
    return jsonResponse({ error: message }, 500);
  }
});
