# SPRINT-02 — Fundação Técnica

Status: proposta para aprovação

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

Preencher em PR documental posterior ao merge da FIT-005.
