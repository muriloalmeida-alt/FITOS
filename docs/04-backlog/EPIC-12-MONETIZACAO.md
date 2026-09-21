# EPIC-12 — Monetização (Fase 2.1 pós-MVP)

## Origem

Pacote `FitOS_Pacote_Pos_MVP_Fases_2_1_Monetizacao_2_2_Livre_v3.zip` (Murilo Almeida, 21/09/2026), lido integralmente (17 documentos + `PROMPT_MESTRE.md` + referências visuais) antes de qualquer código. O pacote define duas evoluções pós-MVP — **2.1 Monetização** (este Épico) e **2.2 FitOS Livre** (EPIC-13) — com a Fase 2.2 dependente do motor de assinatura entregue aqui.

## Nota de transparência — renumeração de identificadores

O pacote original reserva `FIT-070` a `FIT-079` para as histórias deste Épico. Antes de formalizar qualquer Issue, a verificação no GitHub mostrou que esses códigos **já pertencem a Issues fechadas de trabalho anterior e não relacionado**: `FIT-070` é a consolidação visual da SPRINT-11 (#72, EPIC-10) e a faixa correspondente à Fase 2.2 (`FIT-080`–`FIT-089`) colide com os Lotes A–D do redesign (EPIC-11: #74, #77, #78, #80...). O pacote pós-MVP foi evidentemente planejado sem visibilidade da numeração real já consumida por esses dois Épicos.

O próprio `PROMPT_MESTRE.md` do pacote proíbe "renumerar, condensar ou ampliar escopo silenciosamente" — por isso a decisão foi levada a Murilo (Product Owner) antes de qualquer Issue. Decisão aprovada em 21/09/2026: **renumerar para a próxima faixa livre**, preservando o conteúdo e a ordem das histórias do pacote:

| Pacote (original) | FitOS (real, aplicado) |
|---|---|
| FIT-070 a FIT-079 (Fase 2.1 — Monetização) | **FIT-090 a FIT-099** (este Épico) |
| FIT-080 a FIT-089 (Fase 2.2 — FitOS Livre) | **FIT-100 a FIT-109** (EPIC-13) |

Nenhum escopo, critério de aceite ou dependência do pacote foi alterado — apenas o identificador numérico.

## Objetivo

Permitir que o personal contrate e administre sua assinatura SaaS do FitOS inteiramente dentro da aplicação, sem sair para um checkout externo ou parecer um internet banking.

## Autoridades

1. Documentação atual do repositório define comportamento funcional; em conflito, prevalece sobre o pacote.
2. O pacote pós-MVP define direção comercial, jornada e experiência desta fase.
3. O pacote canônico de redesign do MVP (`FitOS_Pacote_Implementacao_Redesign_MVP_v1`) continua sendo a única autoridade visual — este Épico não cria um Design System novo.
4. Documentos já existentes do repositório (`docs/06-engenharia/arquitetura/ASSINATURA-SAAS.md`, `DECISOES-PENDENTES.md`, `ADR-003-ASAAS-COMO-CANDIDATO.md`) já registravam Asaas como candidato condicionado a prova técnica — este Épico não contradiz essas decisões, apenas as executa.

## Restrições obrigatórias (do pacote)

- Asaas permanece candidato até prova técnica documentada (sandbox); reprovado, cair para Mercado Pago (já registrado como fallback em ADR-003).
- Sem cobrança automática de mensalidade de aluno, conta de pagamento do personal, split, saldo, repasse ou saque — fora de escopo nesta fase e nas seguintes, salvo nova decisão de Produto.
- Financeiro manual entre personal e aluno (`StudentCharge`) permanece totalmente separado da assinatura SaaS; nenhum evento de assinatura altera `StudentCharge`.
- Apple Pay/Google Pay somente após confirmação técnica de suporte no fluxo Asaas escolhido.
- Nenhuma chave, token ou dado de cartão no repositório, frontend, logs ou evidências.
- Planos, preços, limites, descontos e teste grátis configuráveis — nunca valores fixos no código.
- Cada História usa branch e PR próprios; PR permanece com status `PRONTO PARA REVISÃO GPT/CODEX — NÃO MERGEAR` até aprovação explícita de GPT/Codex (produto, código, segurança, testes, visual) **e** aceite de Produto por Murilo. Produção exige autorização separada.

## Pré-requisito operacional

A importação única do catálogo de exercícios (`IMP-EX-001`, ver `docs/06-engenharia/arquitetura/INTEGRACAO-API-NINJAS.md`) precede este Épico. Não consome numeração FIT — é preparação de dados compartilhada com o EPIC-13, não uma capacidade nova de usuário.

## Histórias (renumeradas — conteúdo integral no pacote, seção `11_BACKLOG_FASE_2_1_MONETIZACAO.md`)

| Sprint proposta | História | Resumo |
|---|---|---|
| SPRINT-12 — Fundação comercial | FIT-090 | Configurar planos comerciais (preço, ciclo, limite, teste grátis, versionamento de oferta) |
| SPRINT-12 | FIT-091 | Prova técnica do Asaas (sandbox: cliente, assinatura, cobrança, webhook, idempotência, reconciliação, estorno, chargeback) |
| SPRINT-12 | FIT-092 | Contratar assinatura (checkout dentro do FitOS, resumo, aceite) |
| SPRINT-13 — Meios de pagamento | FIT-093 | Pagar por Pix e cartão (tokenizado, sem dado sensível armazenado) |
| SPRINT-13 | FIT-094 | Contratar anual parcelado (até 12x, condicionado à prova do gateway) |
| SPRINT-13 | FIT-095 | Pagar com wallets (Apple Pay/Google Pay, condicionado à prova técnica) |
| SPRINT-14 — Ciclo de vida | FIT-096 | Controlar renovação automática (opt-in, avisos prévios, consentimento auditável) |
| SPRINT-14 | FIT-097 | Gerenciar assinatura (troca de plano, cancelamento sem dark pattern, faturas) |
| SPRINT-14 | FIT-098 | Recuperar pagamentos (retentativa, carência, bloqueio 8-15 dias, modo consulta após 15 dias) |
| SPRINT-14 | FIT-099 | Consolidar central financeira SaaS (ledger, conciliação, auditoria) |

Dependência: `FIT-090 → FIT-091 → FIT-092 → FIT-093`; `FIT-094`/`FIT-095` dependem de `FIT-093`; `FIT-096` depende dos meios aprovados; `FIT-097`/`FIT-098` dependem da renovação; `FIT-099` encerra a fase.

## Direção visual

Shell navy do Personal preservado; Motion Lime só na ação principal/progresso da contratação; Flow Teal para confirmação; `PulseLine` apenas em cabeçalho/progresso/confirmação; uma ação dominante por etapa; sem aparência de banco genérico ou padrão de cancelamento coercivo. Detalhe completo em `07_CONTRATO_VISUAL.md` e `14_ESPECIFICACAO_UX_UI_POS_MVP.md` do pacote.

## Gate de encerramento do Épico

- contratação, pagamento, renovação, gestão e recuperação funcionando em homologação sem cobrança duplicada, divergência de ledger ou exposição de segredo;
- Asaas aceito (ADR-003 atualizado) ou decisão alternativa formalizada;
- nenhuma divergência entre assinatura e `StudentCharge`;
- aprovação explícita de GPT/Codex e aceite de Produto no PR de encerramento.

## Estado do Épico

Aberto. Formalização inicial em 21/09/2026, iniciando pelo pré-requisito `IMP-EX-001`.
