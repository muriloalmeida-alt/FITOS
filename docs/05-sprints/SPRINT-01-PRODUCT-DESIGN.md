# SPRINT-01 — Fundação de Product Design

Status: em revisão  
Objetivo: publicar a identidade visual e o Design System (Material Design 3) do FitOS como fundação documental de UX/UI para as Fases funcionais do roadmap, com o escopo normalizado ao MVP confirmado por Produto — sem iniciar implementação de frontend ou backend.

## Épico

### EPIC-01 — Identidade Visual e Design System (Material Design 3)

Estabelecer marca, tokens M3, arquitetura de UX, biblioteca de componentes, especificação de telas críticas, plano de pesquisa e governança de design, todos aderentes ao escopo confirmado do MVP.

## História da Sprint

### FIT-004 — Publicar identidade visual e Design System (Material Design 3)

Como time do FitOS, queremos a identidade visual e o Design System M3 publicados e versionados, para que toda Fase funcional futura parta de tokens, componentes e telas críticas já decididos e alinhados ao escopo do MVP, em vez de improvisar solução visual própria ou incluir funcionalidades fora de escopo.

Critérios de aceite:

- Identidade de marca, tokens M3, arquitetura de UX, biblioteca de componentes, especificação de telas críticas, plano de pesquisa e governança de design publicados em `docs/03-design/`.
- Documentação alinhada ao escopo confirmado do MVP: autenticação e conta do personal, cadastro e gestão de alunos, biblioteca de exercícios, integração com API Ninjas, montagem e atribuição de treinos, execução e registro de treinos, evolução básica do aluno, gestão financeira e dashboard operacional.
- IA (recomendação/criação de treino), RPE/RIR, sincronização offline, vídeo como requisito obrigatório, agenda, mensagens, relatórios avançados e administração de academias identificados exclusivamente como "Pós-MVP" ou "Hipótese sujeita à decisão de Produto" — nunca como funcionalidade disponível nos fluxos, telas ou eventos analíticos atuais.
- Estados financeiros persistidos normalizados a `pendente`, `pago`, `atrasado` e `cancelado`; "a vencer" apenas como apresentação calculada; sem pagamento parcial nem estorno.
- Matriz de aderência ao escopo publicada em `docs/03-design/PRODUCT-DESIGN.md`.
- Roadmap único (sem trilha de design paralela) e índice de documentação atualizados.
- Asset visual de referência (`fitos-concept-board.png`) tratado como opcional e não bloqueante do aceite.
- Esta entrega acontece por PR, sem alteração direta na `main`.
- Nenhuma implementação de código, arquitetura técnica ou integração efetiva é realizada nesta Sprint.

## Escopo incluído

- Identidade de marca e Design System M3 (documental).
- Reconciliação de estrutura de pastas, convenção de branch/PR e roadmap com a governança já vigente.
- Normalização do escopo documental ao MVP confirmado por Produto.
- Matriz de aderência ao escopo.

## Escopo excluído

- Implementação de código da aplicação (frontend/backend).
- Definição detalhada de arquitetura técnica.
- Implementação do Design System em componentes reais (ex.: React).
- Integração efetiva com a API Ninjas.
- Auditoria completa de aderência do repositório `FitOS` existente.
- Execução do plano de pesquisa com usuários reais.

## Evidência esperada

- PR #8 com toda a documentação de `docs/03-design/`, `docs/00-governanca/ROADMAP.md` e `docs/README.md` atualizados e alinhados ao escopo do MVP.
- Aprovação do Product Owner e do Product Manager/Product Designer (GPT do Murilo).

## Fechamento

Preencher após o merge:

- Entregue:
- Não entregue:
- Decisões tomadas:
- Riscos:
- Próxima Sprint proposta:
