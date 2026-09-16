# EPIC-02 — Fundação Técnica

## Resultado esperado

Estabelecer uma arquitetura segura, multi-tenant, observável e implantável no Railway, suficiente para orientar as Histórias funcionais do MVP sem antecipar implementação.

## Histórias

### FIT-005 — Definição da arquitetura da solução — Concluída (PR #12, merged)

Como time do FitOS, queremos registrar as decisões, limites, modelos e riscos da arquitetura, para implementar o MVP de modo consistente, seguro e evolutivo.

### FIT-006 (#14) — Fundação executável do FitOS — Concluída (PR #17, merged)

Como time do FitOS, queremos materializar a arquitetura aprovada em uma aplicação Next.js/TypeScript executável, com estrutura modular e fundação do Design System, para que as próximas Histórias possam implementar banco, tenancy e funcionalidades sem improvisar estrutura técnica ou visual.

### FIT-007 (#15) — Banco e modelo físico multi-tenant — Concluída (PR #19, merged)

Como time do FitOS, queremos transformar o modelo conceitual aprovado em um schema PostgreSQL/Prisma inicial, com isolamento multi-tenant e migrations rastreáveis, para garantir uma base de dados consistente antes das funcionalidades do MVP.

### FIT-008 (#16) — Ambientes FitOS no Railway — Concluída (PR #20, merged)

Como time do FitOS, queremos disponibilizar a fundação executável e seu banco em ambiente Railway de homologação, para validar deploy, configuração e observabilidade mínima sem expor dados reais.

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
- nenhum fluxo permite acesso entre tenants — comprovado por teste automatizado na FIT-007;
- cobrança SaaS não se confunde com cobranças dos alunos — sem relação física entre os modelos;
- integrações externas possuem limites, segurança e fallback documentados;
- a fundação executável (FIT-006/007/008) materializa a arquitetura aprovada sem antecipar funcionalidades de negócio;
- Histórias posteriores podem ser refinadas sem decisões arquiteturais críticas ocultas.

## Encerramento

As três Histórias da SPRINT-03 (FIT-006, FIT-007, FIT-008) estão concluídas e mergeadas. A fundação executável, o modelo físico multi-tenant e o ambiente de homologação Railway existem. A prova técnica do Better Auth passou a ser tratada como História formal (FIT-009, EPIC-03 — `docs/04-backlog/EPIC-03-IDENTIDADE-ACESSO-NAVEGACAO.md`), não mais como item não identificado deste Épico.

## Histórias posteriores propostas (sem identificador — aguardam priorização de Produto)

- Prova técnica do Asaas.
- CI/CD e observabilidade ampliada.

Essas Histórias só recebem identificadores após priorização de Produto. O EPIC-02 permanece aberto (Issue #10) como container de acompanhamento até que essas Histórias sejam priorizadas e concluídas.
