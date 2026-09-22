# ADR-007 — Seleção de papel no cadastro público (`PERSONAL`/`INDIVIDUAL`), nunca `ALUNO`

Status: **Aceito** (FIT-101, EPIC-13 — FitOS Livre)
Data: 21 de setembro de 2026

## Contexto

Até a FIT-100, o campo `role` do Better Auth (`additionalFields.role`) era `input: false`: o cadastro público (`/criar-conta`) sempre criava `PERSONAL`, sem nenhuma forma de o cliente influenciar esse valor — nem por acidente, nem por má-fé. `UserRole.ALUNO` só é alcançado por convite/ativação (FIT-015, `activation.ts`), nunca por autocadastro.

A FIT-101 (onboarding "Treino sozinho") precisa que o cadastro público também possa criar `role: "INDIVIDUAL"` — a pessoa escolhe, na própria tela de entrada, se está se cadastrando como personal trainer ou para treinar sozinha. Isso exige que `role` deixe de ser inteiramente fixo no servidor e passe a aceitar, de alguma forma, um valor vindo da requisição.

## O risco real

Investigando o código do Better Auth (`parseInputData`, `node_modules/better-auth/dist/db/schema.mjs`): quando `input === false`, qualquer valor de `role` enviado no corpo é **silenciosamente descartado** e substituído por `defaultValue` — não há erro, só é ignorado. Ou seja, simplesmente mudar para `input: true` sem mais nada faria o Better Auth aceitar **qualquer string** enviada por qualquer cliente como `role` — incluindo `"ALUNO"` (auto-concessão de acesso como aluno de qualquer tenant, contornando o convite/ativação inteiro) ou qualquer valor fora do enum físico do banco (que só seria pego depois, no `INSERT`, como um erro 500 de constraint — não uma rejeição limpa).

## Decisão

`role.input: true` **combinado com** `validator.input` — um schema Zod (`z.enum(["PERSONAL", "INDIVIDUAL"])`, chamado `SELF_SERVICE_ROLES` em `auth.ts`) que rejeita com `400 BAD_REQUEST` qualquer valor fora desse conjunto, antes de qualquer escrita no banco. O Better Auth já suporta essa validação nativamente (`fields[key].validator.input`, chamado dentro do próprio `parseInputData`) — não foi necessário nenhum hook nem lógica própria de sanitização.

`"ALUNO"` nunca está no conjunto permitido — continua impossível de obter por autocadastro, exatamente como antes desta mudança. `PERSONAL` e `INDIVIDUAL` são simétricos em privilégio: os dois só resultam em "criar meu próprio tenant, com controle total só dos meus próprios dados" — nenhum dos dois concede acesso a dados de outra pessoa, então permitir a escolha explícita entre eles não é uma escalada de privilégio, é literalmente a pergunta de onboarding que a FIT-101 precisa fazer.

`/criar-conta` (sem parâmetro, ou `?modo=individual`) são as duas únicas rotas públicas deste repositório que chamam `signUp.email` — nenhuma delas jamais lê um `role` arbitrário de query string/formulário e o repassa; cada uma passa um literal fixo (`"PERSONAL"` ou `"INDIVIDUAL"`) decidido pelo próprio código da página, nunca pelo valor de um campo de formulário. O validator do Better Auth é defesa em profundidade — a primeira barreira real é que nenhuma rota deste app jamais encaminha um valor de `role` vindo do usuário sem já tê-lo fixado a um desses dois literais.

## Alternativas consideradas

1. **Manter `input: false` e criar o `User` com um segundo passo server-side** (`signUpEmail` cria `PERSONAL` por padrão, depois um `prisma.user.update` troca para `INDIVIDUAL`). Rejeitada: o hook `databaseHooks.user.create.after` já dispara no primeiro passo e provisionaria o tenant `PERSONAL` errado antes que o segundo passo pudesse corrigir o papel — duplo provisionamento, exatamente o tipo de inconsistência que a autocura de tenant (FIT-010) foi desenhada para nunca precisar corrigir.
2. **`input: true` sem `validator`** (aceitar qualquer string). Rejeitada — é o risco descrito acima: permitiria auto-concessão de `"ALUNO"` ou qualquer valor arbitrário.
3. **`input: true` com `validator.input` restrito a `["PERSONAL", "INDIVIDUAL"]`** (escolhida): aceita exatamente a escolha que o produto precisa, rejeita tudo o mais com um erro limpo (400), sem nenhuma lógica nova de autorização.

## Consequências

- Qualquer requisição a `/api/auth/sign-up/email` com `role` fora de `["PERSONAL", "INDIVIDUAL"]` (incluindo `"ALUNO"`) é rejeitada com `400 BAD_REQUEST` antes de tocar o banco — comprovado em `identity.integration.test.ts`.
- `role` omitido continua criando `PERSONAL` (mesmo `defaultValue` de sempre) — nenhuma mudança de comportamento para o fluxo existente que não passa `role` nenhum.
- Se um dia um novo papel privilegiado for adicionado ao enum `UserRole` sem também decidir explicitamente se ele deve ou não ser autoatribuível, a omissão de atualizar `SELF_SERVICE_ROLES` é seguro por padrão: o novo valor simplesmente continua rejeitado pelo cadastro público até uma decisão explícita adicioná-lo.
