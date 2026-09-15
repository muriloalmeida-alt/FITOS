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

- FIT-001, FIT-010, FIT-011 e FIT-012.

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
- Prescrição automática por IA.
- Wearables e relógios.

## Trilha de Design (Material Design 3)

A partir da FIT-004, o roadmap de produto passa a ter uma trilha de design correspondente, detalhada em `docs/03-design/`. As fases de design não substituem as fases de produto acima — são o detalhamento de UX/UI necessário para entregar cada uma delas.

| Fase de produto | Entregável de design correspondente | Gate |
|---|---|---|
| Fase 0 — Fundação documental | Identidade de marca, benchmark e tokens M3 (claro/escuro) publicados — `BENCHMARK-IDENTIDADE-VISUAL.md`, `M3-DESIGN-TOKENS.md` | G1 — Fundação |
| Fase 1 — Personal e alunos | Dashboard do personal orientado a atenção; cadastro e perfil do aluno — `UX-ARCHITECTURE.md`, `CRITICAL-SCREEN-SPECS.md` | G2 — Personal |
| Fase 2 — Exercícios | Biblioteca de exercícios (busca, filtros, exercício próprio) — `CRITICAL-SCREEN-SPECS.md` | — |
| Fase 3 — Treinos e planos | Builder de treino (etapas, autosave, drag handle) — `CRITICAL-SCREEN-SPECS.md`, `COMPONENT-LIBRARY.md` | — |
| Fase 4 — Experiência do aluno | Treino em execução no celular (uma mão, offline, temporizador) — `CRITICAL-SCREEN-SPECS.md` | G3 — Aluno |
| Fase 5 — Gestão financeira | Visão geral, recebimentos e baixa manual — `CRITICAL-SCREEN-SPECS.md` | G4 — Financeiro |
| Fase 6 — Consolidação operacional | Relatórios e visualização de dados — `BENCHMARK-IDENTIDADE-VISUAL.md` (Seção 10) | — |
| Fora do MVP (IA) | `AIRecommendation` e "Criar primeira versão com IA" são especificação antecipada, não entrega do MVP — `COMPONENT-LIBRARY.md` | G5 — IA (pós-MVP) |

### Gates de qualidade de design

| Gate | Condição para avançar |
|---|---|
| G1 — Fundação | Tokens aprovados, contraste AA e componentes essenciais documentados |
| G2 — Personal | ≥ 80% de conclusão sem ajuda nos testes críticos |
| G3 — Aluno | Registro de série em poucos toques e treino resiliente a interrupções |
| G4 — Financeiro | Estados financeiros inequívocos e trilha de auditoria definida |
| G5 — IA | Usuário entende origem, pode editar e mantém decisão final |

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
