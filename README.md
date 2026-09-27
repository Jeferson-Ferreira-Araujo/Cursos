# Savia

Plataforma simples para pequenos profissionais criarem cursos e disponibilizarem aulas em vídeo aos seus alunos.

Dois contextos no mesmo app:
- **Criador**: cria cursos, envia vídeos (que viram aulas automaticamente), publica, adiciona alunos e libera acesso por curso.
- **Aluno**: vê apenas os cursos aos quais tem acesso, assiste às aulas, marca conclusão e acompanha o progresso.

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
supabase/migrations/       Todas as migrations SQL, versionadas e aplicadas em ordem
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
