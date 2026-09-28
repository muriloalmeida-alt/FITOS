# Onboarding profissional do Personal (FIT-113/FIT-126, EPIC-14/EPIC-16)

## Objetivo e escopo

Seção 7 do pacote: coletar dados complementares do Personal (celular, CREF opcional, faixa de alunos, nome do espaço/negócio, aceite dos termos) em um fluxo de revisão editável, e "direcionar o personal ao primeiro passo útil" depois. A etapa 1 do pacote ("seleção Sou Personal") já é a FIT-112; a FIT-113 cobriu as etapas 2–4 e a conclusão; a **FIT-126 adicionou a seleção de plano** (etapa que a FIT-113 tinha deixado pendente porque o catálogo real só existiria depois da FIT-127).

**Fora do escopo**: os wizards do Aluno vinculado e do FitOS Livre (FIT-114/115/FIT-126 cobre o FitOS Livre separadamente, ver seção própria abaixo).

## Seleção de plano (FIT-126)

A FIT-113 original não tinha etapa de plano — o catálogo da época (ADR-010/FIT-122) só tinha preço zero, então "escolher um plano" não significava nada de real. Com o catálogo real da FIT-127 (preços reais + trial de 30 dias), o wizard ganhou uma **quarta sub-etapa, "Escolha seu plano"**, entre "Perfil profissional" e "Revisão" — o pacote trata seleção de plano como parte do onboarding do Personal, não uma tela separada e opcional.

- Catálogo vindo do servidor (`listActivePlansForAudience("PERSONAL")`), nunca uma lista fixa na interface — cada plano é um cartão de escolha real (`PlanOptionCard`, `src/shared/ui`), com nome, preço, limite de alunos e o disclosure do trial ("30 dias grátis, depois R$X/mês").
- **Nenhum campo de cartão/Pix**: nenhum gateway de pagamento está integrado ainda (FIT-128, ADR-010) — pedir esses dados agora seria fabricar uma coleta sem destino real. "Dados de cobrança" (seção 7 do pacote) se resume, nesta etapa do produto, ao disclosure de preço/trial antes da confirmação.
- A submissão (`POST /api/onboarding-personal`) agora exige `planId` e chama `subscribeTenantToPlan` (mesma função de `/painel/assinatura`, FIT-122/127) depois de salvar o perfil — nunca duas fontes de verdade para "contratar um plano". Se a contratação falhar (plano inválido/inativo, downgrade acima do limite — praticamente impossível num tenant novo, mas tratado do mesmo jeito), o perfil já salvo não é desfeito: `completePersonalOnboarding` é idempotente, reenviar com um `planId` válido só atualiza o mesmo registro.
- Reabrir o onboarding pré-seleciona o plano já contratado (`getSubscriptionForTenant`), nunca força uma nova escolha — trocar de plano de verdade continua sendo `/painel/assinatura`, esta tela só reflete o estado atual.

## Wizard genérico extraído (FIT-126)

`WizardProgress`/`useUnsavedChangesGuard` (`src/shared/ui/Wizard.tsx`) e `PlanOptionCard` (`src/shared/ui/PlanOptionCard.tsx`) foram extraídos desta tela — antes cada wizard (Personal, e agora o FitOS Livre) duplicava o parágrafo "Passo X de Y", o `useEffect` de `beforeunload` e, agora, precisaria duplicar o cartão de plano de novo. Os três perfis do pacote (Personal/Aluno/Livre) foram revisados; o Aluno convidado nunca passa por um wizard de múltiplos passos (é ativação de conta + senha, FIT-015) — só Personal e FitOS Livre reaproveitam o wizard genérico.

## Decisão de arquitetura: dados complementares nunca entram em `signUp.email()`

O pacote agrupa nome/e-mail/celular/senha na mesma "Etapa 2 — Dados da conta". Implementado de outro jeito, deliberadamente: `signUp.email()` (Better Auth) continua recebendo só nome/e-mail/senha/role, exatamente como desde a FIT-009/101 — celular, CREF, faixa de alunos e aceite dos termos são coletados **depois** da criação da conta, num wizard próprio (`/onboarding-personal`), com um model novo (`PersonalProfile`) espelhando `IndividualProfile` (FIT-101).

Por quê: a FIT-101 já resolveu exatamente essa mesma tensão para o workspace individual (objetivo/experiência/disponibilidade também são "dados de onboarding" que o pacote poderia ter agrupado com o cadastro, e foram deliberadamente pós-cadastro) — estender o schema do `User` do Better Auth para caber campos de produto é um acoplamento mais arriscado e specific ao provedor de auth do que adicionar um model de domínio próprio. Manter os dois onboardings (Individual e Personal) com a mesma arquitetura também evita duas formas diferentes de resolver o mesmo problema nesta base.

## Modelagem

`PersonalProfile` (novo, `tenantId` único, mesma forma de `IndividualProfile`): `phone`, `cref` opcional, `studentRangeEstimate` (enum), `termsAcceptedAt`. Nunca ganhou campo de "nome do negócio" — isso já existe como `Tenant.name` desde a FIT-010; a etapa 2 do wizard só oferece editá-lo (pré-preenchido com o valor atual, tipicamente "Espaço de {nome}", o padrão automático da FIT-010).

**Data de nascimento (mencionada na seção 7 do pacote) foi omitida deliberadamente** — o próprio pacote condiciona isso a "se houver justificativa funcional no modelo atual"; não há nenhuma funcionalidade do FitOS que use data de nascimento do Personal.

**Aceite dos termos, atualizado pela FIT-119**: o checkbox agora linka para as páginas reais `/termos-de-uso`/`/politica-de-privacidade` (rascunho, pendente de revisão jurídica final — mesma pendência documentada em `DECISOES-PENDENTES.md`, agora com mecânica completa em vez de texto de espera). `termsAcceptedAt` continua gravando a data da submissão normalmente.

## Gate obrigatório em `/painel` (decisão confirmada com Murilo)

Mesmo padrão do gate já existente para `IndividualProfile` (FIT-101): `/painel` redireciona qualquer `PERSONAL` sem `PersonalProfile` para `/onboarding-personal`, antes de mostrar qualquer conteúdo do workspace. Diferente da FIT-101 (papel `INDIVIDUAL` só passou a existir a partir daquela própria História, então nunca havia uma conta pré-existente para "quebrar"), `PERSONAL` é o papel original da FIT-009 — **isso significa que toda conta Personal já existente (inclusive contas de teste desta sessão) também passa a ser redirecionada** na próxima vez que acessar `/painel`, até completar o novo perfil. Essa consequência foi levantada explicitamente e confirmada com Murilo antes de implementar (ver `AskUserQuestion` desta sessão) — não foi uma decisão silenciosa.

## Conclusão e "primeiro passo útil"

`POST /api/onboarding-personal` decide o redirecionamento no servidor, nunca um valor fixo no cliente: se o tenant ainda não tem nenhum aluno (`listStudents({pageSize:1}).total === 0`), retorna `/painel/alunos/novo`; senão, `/painel`. "Não criar tenants órfãos em caso de falha parcial" (seção 7) já está garantido estruturalmente — o `Tenant` é criado atomicamente no cadastro (hook do Better Auth, FIT-010), antes mesmo deste wizard existir; esta História só completa um perfil sobre um tenant que já existe de forma válida, com ou sem esse perfil. A atualização de `Tenant.name` e o upsert de `PersonalProfile` acontecem na mesma `$transaction`, para nunca deixar um dos dois atualizado sem o outro.

## Fluxo

Quatro sub-etapas dentro de uma única rota real (`/onboarding-personal`) — diferente da decisão de caminho da FIT-112 (que precisava de URLs próprias, por ser compartilhável entre três produtos diferentes), aqui é estado de cliente dentro de um fluxo linear de uma sessão: "Dados complementares" (celular com máscara brasileira, CREF opcional) → "Perfil profissional" (faixa de alunos, nome do espaço, aceite dos termos) → **"Escolha seu plano"** (FIT-126, cartões do catálogo real) → "Revisão" (resumo, com Voltar para cada etapa anterior) → conclusão.

Requisitos comuns (seção 6, aplicados aqui pela mesma família de fluxo da FIT-112): indicador de progresso visual ("Passo X de 4", agora com barra real via `WizardProgress`, FIT-126), Voltar entre sub-etapas, `beforeunload` quando há dado preenchido (`useUnsavedChangesGuard`, FIT-126), mensagens de erro por campo, proteção contra submissão duplicada (`isSubmitting`), feedback de carregamento ("Concluindo…").

## Segurança e LGPD

`tenantId` sempre derivado da sessão (`requirePersonal`), nunca aceito do corpo da requisição — mesmo padrão de `/api/onboarding`. Nenhum dado sensível novo: celular e CREF são dados profissionais de contato, não dados de saúde ou financeiros.

## Critérios de aceite (seção 7 + 17 do pacote) resolvidos por esta História

- [x] Etapa 2 (celular com máscara/validação brasileira, CREF opcional).
- [x] Etapa 3 (faixa de alunos, nome do espaço/negócio, aceite dos termos).
- [x] Etapa 4/FIT-126 (seleção de plano real, com trial).
- [x] Etapa 5/FIT-126 (revisão editável antes da submissão, agora incluindo o plano escolhido).
- [x] Conclusão sem tenant órfão, direcionamento ao "primeiro passo útil".
- [x] Data de nascimento — decisão documentada de omitir, sem justificativa funcional hoje.

## Testes executados

- `src/shared/lib/brazilianPhone.test.ts` (6 testes): máscara progressiva, validação.
- `src/modules/personal-onboarding/onboarding.integration.test.ts` (7 testes, PostgreSQL real): criação, atualização de `Tenant.name` na mesma transação, CREF opcional, idempotência ao reabrir, validações (celular/termos/nome vazio).
- `src/app/api/onboarding-personal/route.test.ts` (12 testes, FIT-126: +4): auth, `tenantId` da sessão, `redirectTo` correto com/sem alunos existentes, validação (incluindo `planId` obrigatório), erro de domínio, erro de assinatura sem quebrar o perfil já salvo.
- `src/app/onboarding-personal/PersonalOnboardingWizard.test.tsx` (9 testes, FIT-126: +3): validação por sub-etapa (incluindo seleção de plano obrigatória), máscara ao digitar, fluxo completo até o redirect com o plano escolhido no corpo da requisição, Voltar preservando dados, pré-seleção do plano já contratado ao reabrir, erro de submissão.
- `src/app/onboarding-personal/page.test.tsx` (3 testes, atualizado): guards de sessão/papel, catálogo real passado ao wizard.
- `src/shared/ui/Wizard.test.tsx` (4 testes, novo, FIT-126): indicador de progresso, guard de dados não salvos.
- `src/shared/ui/PlanOptionCard.test.tsx` (5 testes, novo, FIT-126): dados do plano, disclosure de trial condicional, seleção.
- `src/app/painel/page.test.tsx` (+1 teste, 2 atualizados): redirect para `/onboarding-personal` quando o perfil não existe.
- Suíte completa: 1053/1053. `tsc --noEmit`/`eslint .`/`npm run build`/`npm audit --omit=dev` limpos.

## Evidências

`docs/06-engenharia/evidencias/FIT-113/README.md` — fluxo completo real em navegador (cadastro → gate → 3 passos → redirect para "cadastrar primeiro aluno"), desktop e mobile. **A quarta etapa (seleção de plano, FIT-126) ainda não tem evidência visual própria** — fica para a FIT-129 (revisão visual integral), junto de todas as demais telas que ainda não foram capturadas em homologação real.

## Pendências reais

- FIT-119 criou as páginas reais de Termos de Uso/Política de Privacidade e linkou o checkbox a elas — mas o conteúdo é um rascunho, ainda pendente de revisão por um responsável jurídico (`DECISOES-PENDENTES.md`).
- **Contas Personal/Individual já existentes, cadastradas antes da FIT-126, nunca são levadas de volta a este wizard para escolher um plano** — o gate de `/painel` só verifica a existência do perfil (`PersonalProfile`/`IndividualProfile`), não da assinatura. Isso é intencional para esta História (forçar retroativamente todo tenant existente por este fluxo seria uma migração de dados/produto própria, fora do escopo de "onboarding guiado" — e o próprio documento de decisão exige nunca cobrar usuário gratuito existente sem uma nova escolha explícita) — mas significa que "todo tenant tem uma assinatura" não é uma garantia real ainda. Fica registrado aqui para a FIT-128/FIT-129 decidirem como (e se) migrar essas contas.

## Atualização — CPF/CNPJ obrigatório na Etapa 2 (FIT-128, Issue #153, 28/09/2026)

O Asaas exige `cpfCnpj` para criar um cliente real (`POST /v3/customers`, integração ainda não ligada — `src/modules/billing/asaasClient.ts`) e nenhum onboarding do FitOS coletava esse dado. Decisão de Murilo: cabe em `PersonalProfile`, nunca em `IndividualProfile` — quem paga a assinatura SaaS é sempre o personal, nunca o aluno/individual.

`PersonalProfile.cpfCnpj` (`String?` no schema — nullable só para não fabricar dado retroativo em perfis já existentes, mesmo princípio de `IndividualProfile.termsAcceptedAt`) é obrigatório para toda nova submissão de `completePersonalOnboarding`, validado por `src/shared/lib/cpfCnpj.ts` (`isValidCpfCnpj`, dígito verificador real de CPF/CNPJ, não só contagem de dígitos). Campo novo na Etapa 2 ("Dados complementares"), ao lado de celular/CREF, com máscara progressiva (`formatCpfCnpj`).

**Contas existentes que nunca reabrirem o onboarding continuam com `cpfCnpj: null`** — mesma lacuna estrutural já registrada acima para a assinatura: nenhuma migração retroativa foi feita. A criação real de cliente/assinatura no Asaas (wiring em `subscribeTenantToPlan`/`cancelSubscription`, ADR-010) ainda não foi implementada — fica para uma História separada, que também precisa decidir o que fazer quando `cpfCnpj` for `null` num tenant que já tem assinatura ativa.
