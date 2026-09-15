# ADR-002 — Better Auth como candidato

Status: Proposto — condicionado à prova técnica
Data: 15 de setembro de 2026

## Contexto

Personal e aluno precisam de contas próprias, sessões seguras, recuperação e autorização por papel dentro de uma solução Next.js/PostgreSQL no Railway.

## Alternativas

- Better Auth;
- Clerk;
- Auth0;
- implementação própria.

## Proposta

Avaliar Better Auth como candidato primário por integração TypeScript/PostgreSQL e controle sobre dados. Clerk é fallback pela maturidade e velocidade de integração.

## Condição de aceite

A prova descrita em `../AUTENTICACAO-E-AUTORIZACAO.md` deve comprovar sessões, recuperação, papéis, isolamento de tenants, bloqueios negativos e operação no Railway.

## Consequências

Até a prova ser aprovada, Better Auth não é decisão definitiva e nenhuma implementação dependente deve ser tratada como consolidada.
