# ADR-003 — Asaas como candidato

Status: Proposto — condicionado à prova técnica
Data: 15 de setembro de 2026

## Contexto

O FitOS será SaaS desde o início e precisa cobrar a assinatura do personal no Brasil. Isso é independente do controle manual das mensalidades dos alunos.

## Alternativas

- Asaas;
- Mercado Pago;
- Stripe;
- Pagar.me.

## Proposta

Avaliar Asaas como candidato primário pela aderência ao mercado brasileiro. Mercado Pago é fallback.

## Condição de aceite

A prova descrita em `../ASSINATURA-SAAS.md` deve comprovar sandbox, recorrência, autenticação de webhook, idempotência, falha, recuperação, cancelamento, conciliação e meios de pagamento disponíveis.

## Consequências

Planos, preço, carência e bloqueio seguem pendentes. Nenhuma cobrança produtiva deve ser construída sobre o candidato antes da prova e da atualização deste ADR para `Aceito`.
