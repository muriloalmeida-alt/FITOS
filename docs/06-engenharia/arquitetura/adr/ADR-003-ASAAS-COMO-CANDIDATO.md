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

## Atualização — bloqueio de rede na tentativa de prova técnica (FIT-091, 21/09/2026)

Ao iniciar a FIT-091 (#96, EPIC-12), a sessão de engenharia confirmou que `api.asaas.com` e `api-sandbox.asaas.com` são recusados pelo proxy de egresso com 403 de negação de política no próprio `CONNECT` — diferente da API Ninjas (ADR-004), onde só a documentação estava bloqueada, aqui nenhum host do Asaas é alcançável deste ambiente, com ou sem credencial:

```
"kind":"connect_rejected","detail":"gateway answered 403 to CONNECT (policy denial or upstream failure)","host":"api-sandbox.asaas.com:443"
"kind":"connect_rejected","detail":"gateway answered 403 to CONNECT (policy denial or upstream failure)","host":"api.asaas.com:443"
```

A prova técnica real precisa rodar em um ambiente que alcance o Asaas (Railway ou a máquina do Product Owner) — não é executável desta sessão. Decisão de Murilo: pausar o EPIC-12 na FIT-091 e seguir para o EPIC-13 (FitOS Livre, #97), que não depende de pagamento, até a prova poder ser feita. Nenhum fato do contrato Asaas foi confirmado ou refutado por esta atualização — apenas a inviabilidade de testar a partir daqui.
