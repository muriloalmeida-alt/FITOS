# SPRINT-02 — Fundação Técnica

Status: concluída

## Objetivo

Publicar a arquitetura-base do FitOS, suas decisões, riscos e provas técnicas necessárias, sem implementar código ou infraestrutura.

## Épico e História

- EPIC-02 — Fundação Técnica.
- FIT-005 — Definição da arquitetura da solução.

## Entregáveis

- documentação em `docs/06-engenharia/arquitetura/`;
- ADR-001 do Railway;
- ADR-002 do Better Auth como candidato;
- ADR-003 do Asaas como candidato;
- modelos de contexto, containers, módulos, dados, tenancy e permissões;
- planos de segurança, LGPD, deploy, observabilidade e testes;
- decisões pendentes e Histórias posteriores propostas.

## Critérios de aceite

- arquitetura aderente ao PRD do MVP e ao Product Design aprovado;
- personal e aluno contemplados com acessos distintos;
- isolamento de tenant obrigatório no servidor e no banco;
- Railway confirmado; Better Auth e Asaas permanecem condicionados às provas;
- assinatura do FitOS separada do controle financeiro dos alunos;
- API Ninjas protegida pelo backend;
- nenhum código ou recurso de infraestrutura criado;
- PR documental revisado antes do merge.

## Não entregue nesta Sprint

- provas técnicas executadas;
- aplicação inicializada;
- banco provisionado;
- deploy ou cobrança real;
- decisões comerciais de planos e preços.

## Fechamento

- **PR de entrega:** #12 — `[FIT-005] Definição da arquitetura da solução` (merged).
- **História:** FIT-005 — Issue #11 (closed, encerrada automaticamente pelo merge do PR #12).
- **Épico:** EPIC-02 — Fundação Técnica — Issue #10 (mantida aberta como container das Histórias posteriores da Fundação Técnica).
- **SHA aprovado da entrega (head da branch `docs/FIT-005-arquitetura-solucao` no momento da aprovação):** `366d31ab1dfea0459478726c7eea86526607ebdf`.
- **SHA efetivamente presente na `main` após o merge:** `5a54a3d6e35fc4fd800d3bff6a5e39895dd40229`.
- **Data do fechamento:** 15 de setembro de 2026.
- **Natureza da entrega:** exclusivamente documental. Nenhum código, dependência, configuração de projeto ou recurso de infraestrutura foi implementado ou provisionado nesta Sprint.
- **Estado dos ADRs no fechamento:**
  - ADR-001 (Railway) — `Aceito`.
  - ADR-002 (Better Auth) — permanece `Proposto — condicionado à prova técnica`; fallback Clerk.
  - ADR-003 (Asaas) — permanece `Proposto — condicionado à prova técnica`; fallback Mercado Pago.
- **Decisões pendentes registradas:** ver `docs/06-engenharia/arquitetura/DECISOES-PENDENTES.md` — resultado das provas técnicas (Better Auth, Asaas), planos/preços/teste grátis, carência/suspensão/reativação, limites por plano, provedor S3, e-mail transacional, backup/retenção/restauração, domínios/URLs, retenção e exclusão LGPD, termos comerciais da API Ninjas. Nenhuma pendência foi resolvida ou antecipada silenciosamente nesta Sprint.
- **Histórias técnicas seguintes:** permanecem propostas, sem identificador, dependentes de priorização explícita de Produto — ver "Histórias posteriores propostas" em `docs/04-backlog/EPIC-02-FUNDACAO-TECNICA.md` (prova técnica do Better Auth, prova técnica do Asaas, fundação do projeto Next.js, provisionamento dos ambientes Railway, modelagem física e migrations iniciais, pipeline CI/CD).
