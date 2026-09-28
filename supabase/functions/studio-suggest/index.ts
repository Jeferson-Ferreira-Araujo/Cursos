// Generates a title/description/summary suggestion (staged for the Creator
// to accept/reject) or a chapter list, from a lesson's transcript, using
// Groq's Llama models. Runs server-side; the Groq key never reaches the app.
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
const MODEL = 'openai/gpt-oss-120b';

const SUGGESTION_PROMPTS: Record<string, string> = {
  title_suggestion:
    'Sugira um título curto, claro e atrativo (máximo 8 palavras) para esta aula, em português do Brasil, ' +
    'com base na transcrição abaixo. Responda APENAS com o título, sem aspas e sem explicações.',
  description_suggestion:
    'Escreva uma descrição curta (2 a 3 frases, tom direto e simples) para esta aula, em português do Brasil, ' +
    'com base na transcrição abaixo. Responda APENAS com a descrição.',
  summary_suggestion:
    'Escreva um resumo em bullet points (3 a 6 itens curtos, começando cada um com "- ") dos principais pontos ' +
    'abordados nesta aula, em português do Brasil, com base na transcrição abaixo. Responda APENAS com os bullets.',
};

async function callGroqChat(systemPrompt: string, userContent: string): Promise<string> {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature: 0.4,
    }),
  });
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Falha ao gerar sugestão (Groq): ${response.status} ${errorBody.slice(0, 300)}`);
  }
  const data = await response.json();
  return (data.choices?.[0]?.message?.content ?? '').trim();
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
  if (!job.lesson_id) return jsonResponse({ error: 'Job has no lesson_id' }, 400);

  await markProcessing(adminClient, jobId);

  try {
    if (!GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY não está configurada nos secrets do projeto Supabase. Peça ao administrador para configurá-la.');
    }

    const { data: lesson, error: lessonError } = await adminClient.from('lessons').select('id, title, video_id').eq('id', job.lesson_id).single();
    if (lessonError || !lesson) throw new Error('Aula não encontrada.');
    if (!lesson.video_id) throw new Error('Esta aula ainda não tem um vídeo associado.');

    const { data: transcription, error: transcriptionError } = await adminClient
      .from('transcriptions')
      .select('full_text, segments, status')
      .eq('video_id', lesson.video_id)
      .maybeSingle();
    if (transcriptionError || !transcription || transcription.status !== 'ready' || !transcription.full_text) {
      throw new Error('Gere a transcrição desta aula antes de pedir sugestões.');
    }

    if (job.job_type === 'chapter_suggestion') {
      const segments = (transcription.segments ?? []) as { start: number; text: string }[];
      const transcriptWithTimestamps = segments.map((s) => `[${Math.floor(s.start)}s] ${s.text}`).join('\n').slice(0, 12000);

      const raw = await callGroqChat(
        'A partir da transcrição com marcações de tempo abaixo, sugira de 3 a 6 capítulos para esta aula. ' +
          'Responda APENAS com um array JSON válido, sem markdown, no formato: ' +
          '[{"start_seconds": number, "title": string}]. Os títulos devem ser curtos, em português do Brasil.',
        transcriptWithTimestamps
      );

      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('Não foi possível interpretar os capítulos sugeridos.');
      const chapters: { start_seconds: number; title: string }[] = JSON.parse(jsonMatch[0]);

      await adminClient.from('lesson_chapters').delete().eq('lesson_id', job.lesson_id).eq('source', 'ai');
      await adminClient.from('lesson_chapters').insert(
        chapters.map((c, index) => ({
          account_id: job.account_id,
          lesson_id: job.lesson_id,
          start_seconds: Math.max(0, Math.round(c.start_seconds)),
          title: c.title,
          order_index: index,
          source: 'ai',
        }))
      );

      await adminClient.from('ai_usage_events').insert({ account_id: job.account_id, job_id: jobId, usage_type: 'ai_text_generation', quantity: 1 });
      await markCompleted(adminClient, jobId, { chapters_count: chapters.length });
      return jsonResponse({ chapters_count: chapters.length });
    }

    const promptTemplate = SUGGESTION_PROMPTS[job.job_type];
    if (!promptTemplate) throw new Error(`Tipo de job desconhecido: ${job.job_type}`);

    const suggestionType = job.job_type.replace('_suggestion', '') as 'title' | 'description' | 'summary';
    const content = await callGroqChat(promptTemplate, transcription.full_text.slice(0, 12000));
    if (!content) throw new Error('A IA não retornou nenhum conteúdo.');

    const { data: suggestion, error: insertError } = await adminClient
      .from('ai_suggestions')
      .insert({ account_id: job.account_id, target_type: 'lesson', target_id: job.lesson_id, suggestion_type: suggestionType, content, status: 'pending' })
      .select()
      .single();
    if (insertError || !suggestion) throw new Error('Falha ao salvar a sugestão.');

    await adminClient.from('ai_usage_events').insert({ account_id: job.account_id, job_id: jobId, usage_type: 'ai_text_generation', quantity: 1 });
    await markCompleted(adminClient, jobId, { suggestion_id: suggestion.id });

    return jsonResponse({ suggestion_id: suggestion.id, content });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido ao gerar sugestão.';
    await markFailed(adminClient, jobId, message);
    return jsonResponse({ error: message }, 500);
  }
});
