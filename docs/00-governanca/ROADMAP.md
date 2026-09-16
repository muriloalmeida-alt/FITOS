# FitOS — Roadmap Inicial

O roadmap organiza resultados, não datas fixas. Datas serão definidas no planejamento de cada Sprint.

## Fase 0 — Fundação documental

Objetivo: estabelecer fonte oficial, governança e escopo do MVP.

- Estrutura de documentação.
- PRD e regras de negócio.
- Backlog inicial.
- Templates de issues e PR.
- Definition of Done.

## Fase 1 — Personal e alunos

Objetivo: permitir que o personal acesse uma conta isolada e administre sua carteira.

- Acesso e conta do personal/aluno: implementado pela EPIC-03 — Identidade, Acesso e Navegação (#21, SPRINT-04) — FIT-009, FIT-010, FIT-011, FIT-012 (ver `docs/04-backlog/EPIC-03-IDENTIDADE-ACESSO-NAVEGACAO.md`).
- Gestão de alunos (cadastro, listagem, perfil, ciclo de vida, convite e ativação): implementado pela EPIC-04 — Cadastro e Relacionamento com Alunos (SPRINT-05) — FIT-013, FIT-014, FIT-015 e FIT-016 (ver `docs/04-backlog/EPIC-04-CADASTRO-RELACIONAMENTO-ALUNOS.md`). Identificadores especulativos deste backlog (FIT-001, FIT-017, FIT-018, FIT-019) renumerados a partir do FIT-010/011/012 original — ver nota em `docs/04-backlog/BACKLOG-MVP.md`; plano/evolução/financeiro do perfil especulativo permanecem fora da SPRINT-05 (dependem das Fases 3, 4 e 6).

## Fase 2 — Exercícios

Objetivo: formar a biblioteca de exercícios do FitOS.

- FIT-020, FIT-021 e FIT-022.
- API Ninjas consultada exclusivamente pelo backend.

## Fase 3 — Treinos e planos

Objetivo: criar, reutilizar e atribuir prescrições versionadas.

- FIT-030, FIT-031, FIT-032 e FIT-033.

## Fase 4 — Experiência do aluno

Objetivo: permitir consulta e registro da execução.

- FIT-002, FIT-040, FIT-041 e FIT-042.

## Fase 5 — Gestão financeira

Objetivo: acompanhar cobranças, pagamentos e inadimplência.

- FIT-050, FIT-051, FIT-052 e FIT-053.

## Fase 6 — Consolidação operacional

Objetivo: reunir alertas e indicadores úteis ao trabalho diário do personal.

- FIT-060.

## Fora do MVP

- Aplicativos nativos.
- Marketplace de profissionais.
- Integração com academias.
- Cobrança automática e emissão fiscal.
- Prescrição e recomendação de treino por IA.
- Wearables e relógios.
- RPE/RIR na prescrição e execução de treino.
- Sincronização offline de dados de treino.
- Vídeo como requisito obrigatório na biblioteca de exercícios.
- Agenda.
- Mensagens.
- Relatórios avançados.
- Administração de academias (multiunidade/equipe).

## Trilha de Design (Material Design 3)

A partir da FIT-004 (SPRINT-01 — Fundação de Product Design, ver `docs/05-sprints/SPRINT-01-PRODUCT-DESIGN.md`), o roadmap de produto passa a ter uma trilha de design correspondente, detalhada em `docs/03-design/`. As fases de design não substituem as fases de produto acima — são o detalhamento de UX/UI necessário para entregar cada uma delas, já normalizadas ao escopo do MVP confirmado nesta seção.

| Fase de produto | Entregável de design correspondente | Gate |
|---|---|---|
| Fase 0 — Fundação documental | Identidade de marca, benchmark e tokens M3 (claro/escuro) publicados — `BENCHMARK-IDENTIDADE-VISUAL.md`, `M3-DESIGN-TOKENS.md` | G1 — Fundação |
| Fase 1 — Personal e alunos | Dashboard do personal orientado a atenção; cadastro e perfil do aluno — `UX-ARCHITECTURE.md`, `CRITICAL-SCREEN-SPECS.md` | G2 — Personal |
| Fase 2 — Exercícios | Biblioteca de exercícios (busca, filtros, exercício próprio) — `CRITICAL-SCREEN-SPECS.md` | — |
| Fase 3 — Treinos e planos | Builder de treino (etapas, autosave, drag handle, sem IA/RPE-RIR/vídeo obrigatório) — `CRITICAL-SCREEN-SPECS.md`, `COMPONENT-LIBRARY.md` | — |
| Fase 4 — Experiência do aluno | Treino em execução no celular (uma mão, tratamento de falha de conexão, temporizador) — `CRITICAL-SCREEN-SPECS.md` | G3 — Aluno |
| Fase 5 — Gestão financeira | Visão geral, recebimentos e baixa manual, com os quatro estados persistidos (`pendente`, `pago`, `atrasado`, `cancelado`) — `CRITICAL-SCREEN-SPECS.md` | G4 — Financeiro |
| Fase 6 — Consolidação operacional | Dashboard operacional do MVP; relatórios avançados são pós-MVP — `CRITICAL-SCREEN-SPECS.md` | — |
| Fora do MVP (IA) | `AIRecommendation` e "Criar primeira versão com IA" são especificação pós-MVP, não entrega do MVP — `COMPONENT-LIBRARY.md` | G5 — IA (pós-MVP) |

### Gates de qualidade de design

| Gate | Condição para avançar |
|---|---|
| G1 — Fundação | Tokens aprovados, contraste AA e componentes essenciais documentados |
| G2 — Personal | ≥ 80% de conclusão sem ajuda nos testes críticos |
| G3 — Aluno | Registro de série em poucos toques e treino resiliente a falhas de conexão |
| G4 — Financeiro | Estados financeiros inequívocos (`pendente`, `pago`, `atrasado`, `cancelado`) e trilha de auditoria definida |
| G5 — IA | Usuário entende origem, pode editar e mantém decisão final — aplicável apenas quando a IA for priorizada, pós-MVP |

### Definition of Done de design

- Problema e público identificados.
- Fluxo feliz e exceções mapeados.
- Layouts mobile e desktop quando aplicável.
- Todos os estados do componente especificados.
- Conteúdo realista em português do Brasil.
- Critérios WCAG 2.2 AA atendidos.
- Eventos de analytics definidos.
- Protótipo revisado com Produto e Engenharia.
- Critérios de aceite anexados à Issue (FIT-XXX).
- Documentação atualizada no mesmo PR.
- Escopo do item aderente ao MVP confirmado nesta página, ou explicitamente identificado como "Pós-MVP"/"Hipótese sujeita à decisão de Produto".

## Fundação Técnica (EPIC-02)

A partir da FIT-005 (SPRINT-02 — Fundação Técnica, ver `docs/05-sprints/SPRINT-02-FUNDACAO-TECNICA.md`), a arquitetura da solução está documentada em `docs/06-engenharia/arquitetura/`: visão arquitetural, modelo multi-tenant, modelo conceitual de dados, autenticação/autorização, assinatura SaaS, integração técnica com API Ninjas, segurança/LGPD, ambientes/deploy, observabilidade e estratégia de testes. Nenhuma Fase funcional (1–6) inicia implementação de código sem essa fundação aprovada.

| Decisão arquitetural | Estado | Documento |
|---|---|---|
| Next.js + TypeScript, monólito modular | Confirmado | `arquitetura/VISAO-ARQUITETURAL.md` |
| PostgreSQL + Prisma | Confirmado | `arquitetura/VISAO-ARQUITETURAL.md` |
| Railway (aplicação e banco) | Confirmado — ADR-001 | `arquitetura/adr/ADR-001-RAILWAY-COMO-PLATAFORMA.md` |
| Better Auth (autenticação) | Proposto, condicionado à prova técnica — ADR-002; fallback Clerk | `arquitetura/adr/ADR-002-BETTER-AUTH-COMO-CANDIDATO.md` |
| Asaas (assinatura SaaS) | Proposto, condicionado à prova técnica — ADR-003; fallback Mercado Pago | `arquitetura/adr/ADR-003-ASAAS-COMO-CANDIDATO.md` |
| Multi-tenant: 1 personal = 1 tenant; aluno vinculado a 1 personal | Confirmado | `arquitetura/MODELO-MULTITENANT.md` |
| Assinatura FitOS (SaaS) separada do financeiro dos alunos | Confirmado | `arquitetura/ASSINATURA-SAAS.md` |

Prova técnica do Asaas, pipeline CI/CD e observabilidade ampliada permanecem Histórias futuras, sem identificador ainda — ver "Histórias posteriores propostas" em `docs/04-backlog/EPIC-02-FUNDACAO-TECNICA.md`. A prova técnica do Better Auth passou a ser a História formal FIT-009 (#22, EPIC-03/SPRINT-04).

### Fundação executável (SPRINT-03 — concluída)

A partir da FIT-006 (#14), a Fundação Técnica passou a ter uma contraparte executável: aplicação Next.js/TypeScript, estrutura de monólito modular e Material Design 3 aplicado (ver `docs/05-sprints/SPRINT-03-FUNDACAO-EXECUTAVEL.md` e `docs/06-engenharia/EXECUCAO-LOCAL.md`). FIT-006 (#14), FIT-007 (#15, banco/Prisma) e FIT-008 (#16, ambientes Railway) estão mergeadas — a SPRINT-03 está concluída.

### Acesso e estrutura autenticada (SPRINT-04 — em andamento)

A partir da FIT-009 (#22), o EPIC-03 — Identidade, Acesso e Navegação (#21) materializa a primeira experiência autenticada do FitOS: autenticação (FIT-009), provisionamento de tenant (FIT-010, #23), autorização/isolamento por sessão (FIT-011, #24) e shell autenticado responsivo (FIT-012, #25) — ver `docs/05-sprints/SPRINT-04-ACESSO-ESTRUTURA-AUTENTICADA.md`. Mesmo sequenciamento obrigatório das Sprints anteriores: cada História só inicia após o merge explicitamente autorizado da anterior.
