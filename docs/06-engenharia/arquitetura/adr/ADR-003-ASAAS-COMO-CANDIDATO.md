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

## Atualização — bloqueio reconfirmado e diagnóstico temporário via Railway (FIT-128, 28/09/2026)

Reconfirmado na FIT-128 (EPIC-16): mesmo bloqueio, agora também para `api.mercadopago.com` (fallback documentado). Como Murilo autorizou execução em homologação/Sandbox (nunca produção), foi adicionado um **diagnóstico temporário** — `src/modules/billing/asaasSandboxDiagnostic.ts`, disparado uma única vez por `src/instrumentation.ts` na inicialização do servidor, só quando `NEXT_PUBLIC_APP_ENV=homologacao` — que faz um único `GET /v3/customers?limit=1` no Sandbox usando a variável já existente `API_ASAAS`, e loga só status/duração/formato da resposta (nunca a chave, headers, corpo completo ou dado de cliente). Não é o adaptador real: é só a confirmação de conectividade/autenticação que faltava, a partir de um ambiente (Railway) que de fato alcança a internet — ver `docs/06-engenharia/RUNBOOK-DIAGNOSTICO-ASAAS-HOMOLOGACAO.md`. Slated para remoção depois que o resultado for lido.

## Atualização — conectividade/autenticação confirmadas; cliente HTTP real criado, cobrança ainda não (FIT-128, 28/09/2026)

Murilo confirmou, a partir do log real de `fitos-web-hml` em homologação: `HTTP 200` em `497ms`, formato de listagem válido. **Conectividade e autenticação com o Asaas Sandbox estão empiricamente provadas a partir de um ambiente que Railway de fato alcança.** O diagnóstico temporário (`asaasSandboxDiagnostic.ts`/`instrumentation.ts`) foi removido neste mesmo PR — já cumpriu seu propósito.

Em seu lugar, `src/modules/billing/asaasClient.ts` generaliza a mecânica HTTP provada (header `access_token`, `User-Agent: FitOS/1.0`, base URL do Sandbox, timeout de 15s, erro sanitizado) num cliente reutilizável. **Ainda não é a integração real**: nenhum fluxo de negócio o chama — `subscribeTenantToPlan`/`cancelSubscription` continuam com `NO_PAYMENT_PROVIDER`. Motivo: `POST /v3/customers` do Asaas exige `cpfCnpj`, e nenhum onboarding do FitOS (Personal ou Individual) coleta esse dado hoje — gap descoberto ao investigar o próximo passo, decisão de produto pendente (onde/como coletar, com migration) antes de qualquer criação real de cliente/assinatura. Continua `Proposto — condicionado à prova técnica`: só a primeira linha da prova (`ASSINATURA-SAAS.md`) está feita.
