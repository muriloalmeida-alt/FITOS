# Autenticação e sessão (FIT-009)

Este documento detalha a implementação da FIT-009: a prova técnica do Better Auth (decisão em `adr/ADR-002-BETTER-AUTH-COMO-CANDIDATO.md`) e a fundação de autenticação do FitOS. Complementa, sem substituir, `AUTENTICACAO-E-AUTORIZACAO.md` (direção de produto/arquitetura definida na FIT-005).

## Provedor e versão

Better Auth **1.7.5** — última versão estável da linha 1.x (não beta/rc) no momento da implementação. Integração via `@better-auth/prisma-adapter`, usando o `PrismaClient` já existente (`src/shared/db/prisma.ts`), sem cliente de banco paralelo.

## Isolamento do provedor

Nenhum módulo além de `src/modules/identity/` importa `better-auth` diretamente:

- `src/modules/identity/auth.ts` — instância server-side (`auth`), única fonte de configuração (secret, sessão, campos adicionais, plugins).
- `src/modules/identity/auth-client.ts` — instância client-side (`authClient`), reexporta `signIn`/`signUp`/`signOut`/`useSession`.
- `src/modules/identity/session.ts` — `getServerSession()`, primitiva mínima para Server Components/Route Handlers lerem a sessão.
- `src/app/api/auth/[...all]/route.ts` — handler HTTP do Better Auth (`toNextJsHandler`).
- `src/proxy.ts` — redirecionamento otimista baseado na presença do cookie de sessão (`getSessionCookie`), sem validar a sessão de fato (isso é feito no servidor).

Módulos de negócio futuros (FIT-010 em diante) devem depender de `getServerSession()` ou do contexto de autorização da FIT-011 — nunca de `better-auth` diretamente. Isso é o que permite trocar de provedor sem reescrever a aplicação, conforme exigido pela governança desta Sprint.

## Schema físico adicionado

Migration `20260916010000_add_better_auth_identity` (aditiva; nenhuma migration anterior foi alterada):

- `users` recebe: `role` (enum `UserRole`: `PERSONAL` | `ALUNO`, default `PERSONAL`), `emailVerified` (boolean, default `false`), `image` (opcional), `updatedAt`.
- Nova tabela `sessions`: `id`, `userId` (FK → `users`, `onDelete: Cascade`), `token` (único), `expiresAt`, `ipAddress`/`userAgent` (opcionais), `createdAt`, `updatedAt`.
- Nova tabela `accounts`: `id`, `userId` (FK → `users`, `onDelete: Cascade`), `accountId`, `providerId`, `password` (hash — nunca texto puro), campos OAuth (`accessToken`/`refreshToken`/`idToken`/etc., não usados nesta História, reservados pelo schema base do provedor), `createdAt`, `updatedAt`.
- Nova tabela `verifications`: `id`, `identifier`, `value`, `expiresAt`, `createdAt`, `updatedAt` — parte do schema base do Better Auth; não usada ativamente nesta História (sem envio de e-mail).

O shape exato dessas tabelas não foi adivinhado: foi obtido chamando `getSchema()` (exportado por `better-auth/db`) com a configuração real desta aplicação (`emailAndPassword` habilitado + `additionalFields.role`), garantindo que o schema do Prisma corresponde exatamente ao que o Better Auth 1.7.5 espera.

`role` é um campo nosso (`additionalFields`, `input: false` — nunca aceito do cliente), não parte do schema base do Better Auth. Ele existe para que o papel do usuário seja conhecido sem precisar fazer join com `Tenant`/`Student` — a fonte física de "quem é dono de qual tenant" continua sendo `Tenant.ownerId`/`Student.userId` (FIT-007), não `role`. A camada de autorização (FIT-011) deve usar ambos de forma consistente.

## Fluxos implementados

- **Cadastro de personal** (`/criar-conta`): nome, e-mail, senha, confirmação de senha. `role` sempre `PERSONAL` — nunca aceito do cliente, mesmo que o payload tente enviá-lo (testado). E-mail normalizado (trim + minúsculas) antes do envio. Cadastro duplicado é rejeitado pela constraint única em `users.email`.
- **Login** (`/entrar`): e-mail e senha, para personal ou aluno (qualquer usuário existente). Mensagem de erro genérica ("E-mail ou senha inválidos.") tanto para e-mail inexistente quanto para senha incorreta — testado que ambos os casos retornam o mesmo tipo de erro, para não permitir enumerar contas por essa via.
- **Logout**: remove o registro de sessão (`sessions`) — testado.
- **Sessão server-side**: `getServerSession()` usada em `/painel` (Server Component) para obter `session.user` e redirecionar para `/entrar` quando não há sessão válida.
- **Proteção de rota**: dupla camada — `proxy.ts` (otimista, baseado em cookie, redireciona antes de renderizar) e a própria página (`getServerSession()` + `redirect()`), que é a autorização real. Esconder uma rota no proxy nunca é, por si só, controle de acesso.

## Aluno não possui cadastro público

Não existe formulário, rota ou parâmetro que permita a um cliente não autenticado criar um usuário com `role=ALUNO`. A única rota pública de criação de conta (`/criar-conta`) sempre define `role=PERSONAL` no servidor; testado que mesmo uma tentativa deliberada de enviar `role: "ALUNO"` no payload de cadastro é ignorada. O provisionamento de contas de aluno (a partir de um vínculo criado pelo personal) é escopo da FIT-010/FIT-011, não desta História.

## Segurança

- Senha: nunca armazenada em texto puro (hash em `accounts.password`, gerido pelo Better Auth) — testado.
- Senha: nunca logada — nenhum `console.log`/logger em `identity/` imprime `password`, cookies ou tokens de sessão completos.
- Cookies de sessão: httpOnly, sameSite e (em produção) secure são o padrão do Better Auth — não sobrescritos.
- Mensagens de erro de login não revelam se o e-mail existe (mesmo tipo de erro para e-mail inexistente e senha incorreta).
- Redirecionamento pós-login (`?redirecionar=`) só aceita caminho interno (`startsWith("/")`) — protegido contra open redirect.
- Rate limiting de login: **não implementado nesta História** — ver "Limitações conhecidas" abaixo.
- `BETTER_AUTH_SECRET` e `DATABASE_URL` validados como obrigatórios no servidor (`requiredEnv`, `auth.ts`) — a aplicação falha ao iniciar, de forma clara, se estiverem ausentes, em vez de operar de modo inseguro/silencioso.

## Limitações conhecidas (deliberadamente fora do escopo desta História)

- **Rate limiting de login**: o Better Auth possui suporte nativo a rate limiting, mas configurá-lo e validá-lo adequadamente (limites, storage, mensagens) foi deixado para uma rodada futura — atualmente não há mitigação de força bruta além do custo computacional do hash de senha. Registrado como risco residual conhecido, não como item comprovado.
- **Recuperação de senha e verificação de e-mail**: não implementadas — exigiriam decidir um provedor de envio de e-mail (fora do escopo da FIT-009). A tabela `verifications` existe (schema base do provedor) mas não é usada ativamente.
- **Operação real no Railway**: a integração usa o mesmo PostgreSQL/Prisma já validado em homologação (FIT-008), mas o deploy desta História especificamente não foi testado em Railway nesta rodada — mesma limitação de acesso já registrada em `docs/06-engenharia/evidencias/FIT-008/DEPLOY-HOMOLOGACAO.md`. Ver `docs/06-engenharia/evidencias/FIT-009/` para o que foi e não foi comprovado.
- **OAuth/login social/MFA/passkeys**: fora do escopo do MVP (ver EPIC-03).

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `BETTER_AUTH_SECRET` | Sim | Segredo usado para assinar cookies de sessão e tokens. Nunca commitado — apenas placeholder em `.env.example`. Falha de inicialização clara se ausente. |
| `BETTER_AUTH_URL` | Sim | URL base da aplicação (usada pelo Better Auth para gerar links/cookies corretamente). Em produção, deve ser a URL pública do serviço; em desenvolvimento, `http://localhost:3000`. |

Nenhuma variável adicional expõe segredo via `NEXT_PUBLIC_*` — o cliente (`auth-client.ts`) não precisa de `BETTER_AUTH_SECRET`; ele fala apenas com `/api/auth/*` no mesmo domínio.

## Testes

`src/modules/identity/identity.integration.test.ts` (contra PostgreSQL real, banco de testes): cadastro válido com role padrão PERSONAL, rejeição de cadastro duplicado, rejeição de tentativa de definir role=ALUNO no cadastro, senha nunca em texto puro, login válido, rejeição de senha incorreta, mesma classe de erro para e-mail inexistente vs. senha incorreta, sessão válida recuperável pelo token, logout remove a sessão.

`src/proxy.test.ts`: redirecionamento para `/entrar` sem cookie em rota protegida, acesso permitido com cookie, redirecionamento para `/painel` ao acessar `/entrar` já autenticado, acesso normal a `/entrar` sem sessão.

`src/app/criar-conta/CriarContaForm.test.tsx` e `src/app/entrar/EntrarForm.test.tsx`: validação de formulário (campos vazios, senhas divergentes), normalização de e-mail, mensagens de erro genéricas (sem revelar motivo exato de falha de cadastro; sem revelar existência de conta no login), proteção contra open redirect no parâmetro de redirecionamento.

## Rollback

```sql
DROP TABLE IF EXISTS "verifications";
ALTER TABLE "accounts" DROP CONSTRAINT IF EXISTS "accounts_userId_fkey";
DROP TABLE IF EXISTS "accounts";
ALTER TABLE "sessions" DROP CONSTRAINT IF EXISTS "sessions_userId_fkey";
DROP TABLE IF EXISTS "sessions";
ALTER TABLE "users" DROP COLUMN IF EXISTS "updatedAt";
ALTER TABLE "users" DROP COLUMN IF EXISTS "role";
ALTER TABLE "users" DROP COLUMN IF EXISTS "image";
ALTER TABLE "users" DROP COLUMN IF EXISTS "emailVerified";
DROP TYPE IF EXISTS "UserRole";
```

Como sempre, a política é forward-only: reverter significa criar uma nova migration que desfaz a alteração, nunca editar `20260916010000_add_better_auth_identity` depois de aplicada em ambiente compartilhado.
