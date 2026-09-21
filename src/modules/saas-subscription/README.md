# Módulo: Assinatura SaaS

Responsabilidade: plano do FitOS e situação de acesso do personal trainer (`docs/06-engenharia/arquitetura/ASSINATURA-SAAS.md`).

Candidato arquitetural: Asaas (ADR-003 — Proposto, condicionado à prova técnica; fallback Mercado Pago). Nenhuma integração de cobrança real existe ainda (FIT-091).

## `plans.ts` (FIT-090, EPIC-12)

Catálogo de planos comerciais versionado — `CommercialPlan`. Detalhe completo em `docs/06-engenharia/arquitetura/PLANOS-COMERCIAIS.md`. Não depende de Asaas nem de nenhum tenant; nenhuma UI consome este catálogo ainda (chega na FIT-092).

`SaasSubscription` (modelo já existente desde a FIT-007) continua sem referência a `CommercialPlan` — a FK entra na FIT-092, junto com a integração real de cobrança.
