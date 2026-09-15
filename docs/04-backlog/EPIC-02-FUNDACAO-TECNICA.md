# EPIC-02 — Fundação Técnica

## Resultado esperado

Estabelecer uma arquitetura segura, multi-tenant, observável e implantável no Railway, suficiente para orientar as Histórias funcionais do MVP sem antecipar implementação.

## Histórias

### FIT-005 — Definição da arquitetura da solução — Concluída (PR #12, merged)

Como time do FitOS, queremos registrar as decisões, limites, modelos e riscos da arquitetura, para implementar o MVP de modo consistente, seguro e evolutivo.

### FIT-006 (#14) — Fundação executável do FitOS — Implementada, em revisão (SPRINT-03)

Como time do FitOS, queremos materializar a arquitetura aprovada em uma aplicação Next.js/TypeScript executável, com estrutura modular e fundação do Design System, para que as próximas Histórias possam implementar banco, tenancy e funcionalidades sem improvisar estrutura técnica ou visual.

### FIT-007 (#15) — Banco e modelo físico multi-tenant — Não iniciada (SPRINT-03)

Aguarda o merge explicitamente autorizado da FIT-006.

### FIT-008 (#16) — Ambientes FitOS no Railway — Não iniciada (SPRINT-03)

Aguarda o merge explicitamente autorizado da FIT-007.

## Escopo

- visão arquitetural e limites dos módulos;
- tenancy, papéis e autorização;
- modelo conceitual de dados;
- assinatura SaaS separada do financeiro dos alunos;
- integração API Ninjas;
- Railway, ambientes, deploy e rollback;
- segurança, LGPD, observabilidade e testes;
- ADRs confirmados e candidatos sujeitos a prova;
- fundação executável (aplicação, banco físico e ambientes), materializada de forma incremental na SPRINT-03.

## Fora do escopo

- execução das provas técnicas de Better Auth e Asaas;
- escolha definitiva de Better Auth ou Asaas antes das provas;
- aplicativos nativos, IA, offline, agenda, mensagens e demais itens pós-MVP;
- qualquer funcionalidade de negócio (Alunos, Exercícios, Treinos, Financeiro).

## Critérios de sucesso

- decisões confirmadas distinguem-se de propostas;
- nenhum fluxo permite acesso entre tenants;
- cobrança SaaS não se confunde com cobranças dos alunos;
- integrações externas possuem limites, segurança e fallback documentados;
- a fundação executável (FIT-006/007/008) materializa a arquitetura aprovada sem antecipar funcionalidades de negócio;
- Histórias posteriores podem ser refinadas sem decisões arquiteturais críticas ocultas.

## Histórias posteriores propostas (sem identificador — aguardam priorização de Produto)

- Prova técnica do Better Auth.
- Prova técnica do Asaas.
- CI/CD e observabilidade ampliada.
- Primeira História funcional do MVP (conforme dependências, após a SPRINT-03).

Essas Histórias só recebem identificadores após priorização de Produto. O EPIC-02 permanece aberto (Issue #10) como container de acompanhamento até que essas Histórias sejam priorizadas e concluídas.
