# Onboarding profissional do Personal (FIT-113, EPIC-14)

## Objetivo e escopo

Seção 7 do pacote: coletar dados complementares do Personal (celular, CREF opcional, faixa de alunos, nome do espaço/negócio, aceite dos termos) em um fluxo de revisão editável, e "direcionar o personal ao primeiro passo útil" depois. A etapa 1 do pacote ("seleção Sou Personal") já é a FIT-112; esta História cobre as etapas 2–4 e a conclusão.

**Fora do escopo**: os wizards do Aluno vinculado e do FitOS Livre (FIT-114/115).

## Decisão de arquitetura: dados complementares nunca entram em `signUp.email()`

O pacote agrupa nome/e-mail/celular/senha na mesma "Etapa 2 — Dados da conta". Implementado de outro jeito, deliberadamente: `signUp.email()` (Better Auth) continua recebendo só nome/e-mail/senha/role, exatamente como desde a FIT-009/101 — celular, CREF, faixa de alunos e aceite dos termos são coletados **depois** da criação da conta, num wizard próprio (`/onboarding-personal`), com um model novo (`PersonalProfile`) espelhando `IndividualProfile` (FIT-101).

Por quê: a FIT-101 já resolveu exatamente essa mesma tensão para o workspace individual (objetivo/experiência/disponibilidade também são "dados de onboarding" que o pacote poderia ter agrupado com o cadastro, e foram deliberadamente pós-cadastro) — estender o schema do `User` do Better Auth para caber campos de produto é um acoplamento mais arriscado e specific ao provedor de auth do que adicionar um model de domínio próprio. Manter os dois onboardings (Individual e Personal) com a mesma arquitetura também evita duas formas diferentes de resolver o mesmo problema nesta base.

## Modelagem

`PersonalProfile` (novo, `tenantId` único, mesma forma de `IndividualProfile`): `phone`, `cref` opcional, `studentRangeEstimate` (enum), `termsAcceptedAt`. Nunca ganhou campo de "nome do negócio" — isso já existe como `Tenant.name` desde a FIT-010; a etapa 2 do wizard só oferece editá-lo (pré-preenchido com o valor atual, tipicamente "Espaço de {nome}", o padrão automático da FIT-010).

**Data de nascimento (mencionada na seção 7 do pacote) foi omitida deliberadamente** — o próprio pacote condiciona isso a "se houver justificativa funcional no modelo atual"; não há nenhuma funcionalidade do FitOS que use data de nascimento do Personal.

**Aceite dos termos sem link real**: não existe hoje nenhuma página de Termos de Uso/Política de Privacidade (mesma pendência documentada no rodapé da landing, FIT-110). O checkbox é apresentado com o texto honesto "Termos de uso e Política de Privacidade — em preparação" ao lado, nunca um link morto fingindo que o documento existe. `termsAcceptedAt` grava a data da submissão mesmo assim — quando a página real existir, o registro já existente permanece válido (o aceite foi genuíno, só a página ainda não existia).

## Gate obrigatório em `/painel` (decisão confirmada com Murilo)

Mesmo padrão do gate já existente para `IndividualProfile` (FIT-101): `/painel` redireciona qualquer `PERSONAL` sem `PersonalProfile` para `/onboarding-personal`, antes de mostrar qualquer conteúdo do workspace. Diferente da FIT-101 (papel `INDIVIDUAL` só passou a existir a partir daquela própria História, então nunca havia uma conta pré-existente para "quebrar"), `PERSONAL` é o papel original da FIT-009 — **isso significa que toda conta Personal já existente (inclusive contas de teste desta sessão) também passa a ser redirecionada** na próxima vez que acessar `/painel`, até completar o novo perfil. Essa consequência foi levantada explicitamente e confirmada com Murilo antes de implementar (ver `AskUserQuestion` desta sessão) — não foi uma decisão silenciosa.

## Conclusão e "primeiro passo útil"

`POST /api/onboarding-personal` decide o redirecionamento no servidor, nunca um valor fixo no cliente: se o tenant ainda não tem nenhum aluno (`listStudents({pageSize:1}).total === 0`), retorna `/painel/alunos/novo`; senão, `/painel`. "Não criar tenants órfãos em caso de falha parcial" (seção 7) já está garantido estruturalmente — o `Tenant` é criado atomicamente no cadastro (hook do Better Auth, FIT-010), antes mesmo deste wizard existir; esta História só completa um perfil sobre um tenant que já existe de forma válida, com ou sem esse perfil. A atualização de `Tenant.name` e o upsert de `PersonalProfile` acontecem na mesma `$transaction`, para nunca deixar um dos dois atualizado sem o outro.

## Fluxo

Três sub-etapas dentro de uma única rota real (`/onboarding-personal`) — diferente da decisão de caminho da FIT-112 (que precisava de URLs próprias, por ser compartilhável entre três produtos diferentes), aqui é estado de cliente dentro de um fluxo linear de uma sessão: "Dados complementares" (celular com máscara brasileira, CREF opcional) → "Perfil profissional" (faixa de alunos, nome do espaço, aceite dos termos) → "Revisão" (resumo, com Voltar para cada etapa anterior) → conclusão.

Requisitos comuns (seção 6, aplicados aqui pela mesma família de fluxo da FIT-112): indicador de progresso ("Passo X de 3"), Voltar entre sub-etapas, `beforeunload` quando há dado preenchido, mensagens de erro por campo, proteção contra submissão duplicada (`isSubmitting`), feedback de carregamento ("Concluindo…").

## Segurança e LGPD

`tenantId` sempre derivado da sessão (`requirePersonal`), nunca aceito do corpo da requisição — mesmo padrão de `/api/onboarding`. Nenhum dado sensível novo: celular e CREF são dados profissionais de contato, não dados de saúde ou financeiros.

## Critérios de aceite (seção 7 + 17 do pacote) resolvidos por esta História

- [x] Etapa 2 (celular com máscara/validação brasileira, CREF opcional).
- [x] Etapa 3 (faixa de alunos, nome do espaço/negócio, aceite dos termos).
- [x] Etapa 4 (revisão editável antes da submissão).
- [x] Conclusão sem tenant órfão, direcionamento ao "primeiro passo útil".
- [x] Data de nascimento — decisão documentada de omitir, sem justificativa funcional hoje.

## Testes executados

- `src/shared/lib/brazilianPhone.test.ts` (6 testes): máscara progressiva, validação.
- `src/modules/personal-onboarding/onboarding.integration.test.ts` (7 testes, PostgreSQL real): criação, atualização de `Tenant.name` na mesma transação, CREF opcional, idempotência ao reabrir, validações (celular/termos/nome vazio).
- `src/app/api/onboarding-personal/route.test.ts` (8 testes): auth, `tenantId` da sessão, `redirectTo` correto com/sem alunos existentes, validação, erro de domínio.
- `src/app/onboarding-personal/PersonalOnboardingWizard.test.tsx` (6 testes): validação por sub-etapa, máscara ao digitar, fluxo completo até o redirect, Voltar preservando dados, erro de submissão.
- `src/app/onboarding-personal/page.test.tsx` (3 testes): guards de sessão/papel.
- `src/app/painel/page.test.tsx` (+1 teste, 2 atualizados): redirect para `/onboarding-personal` quando o perfil não existe.
- Suíte completa: 935/935. `tsc --noEmit`/`eslint .`/`npm run build` limpos.

## Evidências

`docs/06-engenharia/evidencias/FIT-113/README.md` — fluxo completo real em navegador (cadastro → gate → 3 passos → redirect para "cadastrar primeiro aluno"), desktop e mobile.

## Pendências reais

- O link real de Termos de Uso/Política de Privacidade continua pendente (mesma pendência da FIT-110) — quando existir, nenhuma migração de dados é necessária; os aceites já registrados permanecem válidos.
