# Savia

Plataforma simples para pequenos profissionais criarem cursos e disponibilizarem aulas em vídeo aos seus alunos.

Dois contextos no mesmo app (qualquer usuário pode ter os dois, e alternar entre eles a qualquer momento):
- **Criador**: cria cursos, envia vídeos (que viram aulas automaticamente), publica, adiciona alunos e libera acesso por curso.
- **Aluno**: vê apenas os cursos aos quais tem acesso, assiste às aulas, marca conclusão e acompanha o progresso.

**V2 — Savia Studio**: o Criador grava, a Savia melhora. Uma área dedicada gera
legendas/transcrição, sugere título/descrição/resumo/capítulos por IA e cria
opções de capa — tudo isso usando serviços de IA gratuitos (ver seção própria
abaixo), preservando sempre o vídeo original.

## Stack

- React Native + Expo SDK 54 + TypeScript
- Expo Router (navegação por arquivos)
- Supabase (Postgres + Auth + Storage) como backend
- EAS Build para gerar o APK Android

## Estrutura do projeto

```
app/                      Rotas (Expo Router)
  (auth)/                 Login, cadastro, recuperar senha
  onboarding.tsx           Escolha "Sou Criador" / "Sou Aluno"
  (creator)/               Tabs do Criador: Início, Cursos, Alunos, Configurações
  (student)/                Tabs do Aluno: Meus cursos, Perfil
  reset-password.tsx        Alvo do link de redefinição de senha (deep link)
src/
  domain/                  Regras de negócio por domínio (auth, accounts, courses,
                            lessons, videos, students, progress) — cada um com
                            types.ts + api.ts (chamadas ao Supabase)
  components/ui/           Componentes reutilizáveis (Button, Card, TextField, ...)
  theme/                   Cores, espaçamento e tipografia da identidade Savia
  hooks/                   Hooks compartilhados (ex.: useAsyncData)
  utils/                   Validação (zod), formatação, tratamento de erro
  domain/studio/           Savia Studio: jobs de IA, transcrição, legendas, capítulos,
                            sugestões, capas (types.ts + api.ts, mesmo padrão dos outros domínios)
supabase/migrations/       Todas as migrations SQL, versionadas e aplicadas em ordem
supabase/functions/        Edge Functions (Deno) que chamam as APIs de IA — as chaves
                            ficam só aqui, nunca no app
```

### Camada de vídeo (troca futura de provider)

`src/domain/videos/types.ts` define a interface `VideoProvider` (upload, URL de
reprodução, remoção). A implementação atual (`SupabaseStorageVideoProvider`)
usa o Storage do Supabase. Para trocar por um serviço de streaming/transcodificação
dedicado no futuro, basta escrever um novo provider e trocar a única linha em
`src/domain/videos/index.ts` — nenhuma tela ou regra de domínio precisa mudar.

## Banco de dados e segurança

Tabelas principais: `profiles`, `accounts`, `account_members`, `courses`, `lessons`,
`videos`, `invitations`, `enrollments`, `lesson_progress`.

- **Multi-tenant real**: toda tabela de conteúdo tem `account_id` e RLS que
  restringe leitura/escrita a `is_account_member(account_id)` (Criador) ou a
  `has_active_enrollment(course_id)` (Aluno, e somente em curso publicado).
  Isso foi testado diretamente no banco simulando dois Criadores e um Aluno via
  `SET LOCAL request.jwt.claim.sub` — um Criador não consegue ler, atualizar
  nem apagar dados de outra conta, mesmo manipulando IDs diretamente.
- **Revogação real**: remover o acesso de um aluno (`revoke_course_access`)
  derruba a visibilidade do curso, das aulas, do vídeo e do progresso na
  hora seguinte — não é um filtro só na UI.
- **Convite/matrícula**: `add_student` cria/atualiza uma linha em `invitations`
  pelo e-mail. Se esse e-mail já tem conta, já vincula na hora; senão, vincula
  sozinho assim que a pessoa se cadastra (trigger `handle_new_user`).
- **Storage**: bucket `lesson-videos` é privado; política de leitura do aluno
  segue exatamente a mesma regra de curso publicado + matrícula ativa. Bucket
  `course-covers` é público (capas não são conteúdo sensível).
- Todas as migrations estão em `supabase/migrations/`, numeradas e comentadas.

## Savia Studio (V2)

Tabelas novas (todas com `account_id` + as mesmas políticas RLS do resto do
projeto): `video_processing_jobs`, `video_versions`, `transcriptions`,
`captions`, `lesson_chapters`, `ai_suggestions`, `course_covers`,
`ai_usage_events`. Nenhuma tabela ou dado da V1 foi removido ou alterado.

**Como funciona um "job" do Studio:**
1. O app insere uma linha em `video_processing_jobs` (`status: pending`) — a
   política RLS já garante que só o dono da conta cria jobs para si mesmo.
2. O app chama a Edge Function correspondente (`studio-transcribe`,
   `studio-suggest` ou `studio-generate-cover`), passando só o `job_id`.
3. A função valida a posse do job usando o **próprio token do usuário** (a
   mesma RLS de sempre — se a linha não voltar, é 404, nunca vaza dado de
   outra conta), processa usando a `service_role key` (só existe dentro da
   função, nunca no app) e grava o resultado.
4. A função atualiza o job para `completed`/`failed`. Como ela roda até o
   fim no servidor mesmo que o app feche a conexão, o processamento não
   depende do aplicativo continuar aberto.

**Original sempre preservado**: `video_versions` guarda cada variante de um
vídeo (a linha `original` nunca é apagada); a legenda fica em uma tabela
separada da transcrição para que trocar Topo/Rodapé/Desativada nunca dispare
reprocessamento; sugestões de IA (`ai_suggestions`) ficam com `status:
pending` até o Criador aceitar ou rejeitar — nada é aplicado sozinho.

**Isolamento multi-tenant**: testado do mesmo jeito que a V1 (dois Criadores
+ um Aluno simulados via `SET LOCAL request.jwt.claim.sub` direto no banco) —
um Criador não vê transcrição, sugestão, capítulo ou capa de outra conta; o
Aluno só vê transcrição/legenda/capítulos do que estiver matriculado e
publicado, e só o texto completo da transcrição se o Criador ligar
`visible_to_students` para aquela aula.

## APIs externas usadas pelo Studio

Só duas, ambas gratuitas hoje, e sempre chamadas de dentro de uma Edge
Function (a chave nunca entra no app/APK):

| Função | Serviço | O que faz | Chave necessária |
|---|---|---|---|
| Transcrição + legendas | [Groq](https://console.groq.com/keys) (Whisper) | Transcreve o áudio do vídeo com timestamps | `GROQ_API_KEY` |
| Título/descrição/resumo/capítulos | [Groq](https://console.groq.com/keys) (Llama 3.3) | Gera sugestões de texto a partir da transcrição | mesma `GROQ_API_KEY` |
| Capas do curso | [Pollinations.ai](https://pollinations.ai) | Gera imagens a partir do nome/descrição do curso | nenhuma (API pública, sem chave) |

Para configurar: painel do Supabase → projeto → **Edge Functions → Secrets** →
adicionar `GROQ_API_KEY` (gratuita, sem cartão, em console.groq.com/keys).
Sem esse secret, as funções de transcrição/sugestão respondem com um erro
claro em vez de falhar silenciosamente ou simular um resultado.

**Limite conhecido**: o plano gratuito do Groq aceita até 25MB por arquivo de
transcrição. Vídeos maiores que isso recebem uma mensagem de erro específica
em vez de travar — o caminho para remover esse limite é migrar para o plano
pago do Groq (ainda muito barato, ~$0,04–0,11 por hora de áudio).

**Adiado para uma V2.1** (não tem opção gratuita real, é processamento de GPU
cobrado por uso em qualquer provedor sério): melhorar áudio (redução de
ruído/normalização), melhorar vídeo (nitidez/iluminação) e remover pausas
longas automaticamente. A tabela `video_versions` e o `job_type` do
`video_processing_jobs` já têm os valores (`audio_enhanced`, `video_enhanced`,
`silence_removed`) reservados para quando isso for implementado — não é
preciso alterar o schema de novo. O caminho recomendado nessa hora é o
[Replicate](https://replicate.com) (pay-per-use, hospeda os modelos prontos).

## Configuração

1. Copie `.env.example` para `.env` e preencha com os dados do **seu** projeto
   Supabase (Settings → API no painel):
   ```
   EXPO_PUBLIC_SUPABASE_URL=...
   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
   ```
   Nunca coloque a `service_role key` aqui — o app só usa a chave publicável/anon,
   e toda a segurança fica por conta das políticas RLS.

2. Rode as migrations de `supabase/migrations/` no seu projeto, em ordem, pelo
   SQL editor do Supabase (ou `supabase db push` se usar a CLI local).

3. **Importante para testes**: por padrão, o Supabase exige confirmação de
   e-mail no cadastro e o envio de e-mail do plano gratuito é limitado
   (poucos e-mails por hora). Para testar o fluxo rapidamente:
   - Vá em **Authentication → Sign In / Providers → Email** no painel do
     Supabase e desative "Confirm email", **ou**
   - Configure um provedor de SMTP próprio em **Authentication → Emails**.

4. Instale as dependências e rode o app:
   ```
   npm install
   npx expo start
   ```

## Build Android (APK)

O projeto já está configurado com `eas.json`:
- `preview`: gera **APK** direto instalável (uso: testes, distribuição interna).
- `production`: gera **AAB** (para publicar na Play Store).

```
npx eas-cli build --platform android --profile preview
```

As variáveis `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
precisam existir também como **variáveis de ambiente do projeto na EAS**
(`eas env:create`), pois são embutidas no bundle durante o build na nuvem, que
não tem acesso ao seu `.env` local.

## O que foi implementado

- Cadastro, login, logout, recuperação de senha (com deep link `savia://reset-password`).
- Onboarding com escolha de contexto (Criador / Aluno).
- Criador: dashboard, CRUD de cursos (rascunho/publicado, capa, descrição),
  CRUD de aulas com reordenação, upload de múltiplos vídeos que viram aulas
  automaticamente (com progresso real de envio), gestão de alunos (adicionar
  por nome/e-mail, dar/remover acesso por curso, ver progresso), perfil/config.
- Aluno: Meus Cursos (só os autorizados), lista de aulas com progresso, player
  de vídeo com continuar-de-onde-parou, marcar aula concluída, próxima/anterior,
  tela de curso concluído, perfil.
- RLS completo e testado para isolamento multi-tenant e bloqueio de acesso revogado.
- Qualquer usuário pode criar seu próprio curso a qualquer momento ("Criar meu
  curso" nas telas de Aluno) e alternar entre os dois contextos livremente.
- **Savia Studio (V2)**: legendas/transcrição automática (Groq Whisper), correção
  manual do texto, posição da legenda no player (Topo/Rodapé/Opcional/Desativada),
  transcrição visível ao aluno quando o Criador habilitar; sugestões de
  título/descrição/resumo por IA (aceitar/rejeitar, nunca aplicado sozinho);
  capítulos automáticos a partir da transcrição (editáveis/removíveis);
  thumbnail automática por aula (frame extraído no aparelho) com opção de
  upload manual; geração de capa do curso por IA (3 opções, mais upload
  manual) sem sobrescrever a capa atual sem confirmação; ação "Melhorar meu
  curso" que roda tudo isso de uma vez com uma tela de progresso e depois uma
  tela de revisão para aceitar/rejeitar cada sugestão.

## Limitações conhecidas

- Sem transcodificação/adaptação de bitrate: o vídeo enviado é servido como
  está (via signed URL). Está isolado atrás de uma interface (`VideoProvider`)
  pensada para permitir plugar um serviço de streaming depois.
- Duração do vídeo (`duration_seconds`) não é extraída automaticamente no
  upload — fica em branco até ser preenchida (não bloqueia nenhum fluxo).
- Sem envio de e-mail de convite automático: o aluno precisa se cadastrar
  (ou logar, se já tiver conta) com o mesmo e-mail que o Criador cadastrou;
  o vínculo acontece sozinho no cadastro/login. Isso evita precisar da
  `service_role key`/Admin API dentro do app.
- Sem testes automatizados (unitários/E2E) no repositório; a validação de
  RLS e do fluxo de negócio foi feita com consultas diretas simulando dois
  Criadores e um Aluno reais no banco. Os testes de UI (upload de vídeo real,
  reprodução, fechar/reabrir o app) precisam ser feitos no APK, no aparelho.
- **Melhorar áudio, melhorar vídeo e remover pausas longas ficaram fora desta
  entrega** (não existe opção gratuita real para isso — ver seção "APIs
  externas" acima). O restante do Studio (legendas, transcrição, sugestões de
  texto, capítulos, thumbnails, capa) está completo e funcional.
- Transcrição tem teto de 25MB por vídeo no plano gratuito do Groq (aulas
  longas/pesadas podem não caber — a mensagem de erro é clara quando isso
  acontece, não falha silenciosamente).
- "Escolher outro frame" da thumbnail não foi implementado (exigiria um
  scrubber de vídeo); hoje a thumbnail automática é sempre do segundo 1, e a
  alternativa é enviar uma imagem manual.
- As Edge Functions do Studio dependem do secret `GROQ_API_KEY` estar
  configurado no projeto Supabase (ver "APIs externas" acima) — sem ele, elas
  respondem com erro explicando o que falta, em vez de simular um resultado.
