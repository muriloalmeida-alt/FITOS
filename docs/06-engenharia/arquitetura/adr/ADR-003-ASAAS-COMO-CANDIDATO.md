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

## Atualização — CPF/CNPJ coletado; wiring real ainda pendente (FIT-128, Issue #153, 28/09/2026)

Murilo decidiu: `cpfCnpj` cabe em `PersonalProfile`, nunca em `IndividualProfile` (quem paga a assinatura SaaS é sempre o personal). Implementado: campo `PersonalProfile.cpfCnpj` (migration), validação real por dígito verificador (`src/shared/lib/cpfCnpj.ts`), obrigatório na Etapa 2 do wizard (`/onboarding-personal`) — ver `ONBOARDING-PERSONAL.md`. Contas existentes que não reabrirem o onboarding continuam com `cpfCnpj: null` (nunca fabricado retroativamente).

**O wiring real (chamar `createAsaasCustomer`/criar assinatura de fato dentro de `subscribeTenantToPlan`/`cancelSubscription`, por `asaasClient.ts`) ainda não foi implementado** — falta decidir o(s) meio(s) de pagamento (`billingType` do Asaas: boleto/cartão/Pix/todos) antes de criar uma assinatura recorrente real, e o webhook de conciliação (ADR-010) continua não iniciado. Segue `Proposto — condicionado à prova técnica`.

## Atualização — wiring real em modo de melhor esforço; webhook ainda pendente (FIT-128, 28/09/2026)

Murilo decidiu o(s) meio(s) de pagamento: Pix, cartão de crédito e carteiras digitais — nunca um único meio fixo. `subscribeTenantToPlan`/`cancelSubscription` (`src/modules/billing/subscriptions.ts`) agora tentam, em **modo de melhor esforço**, criar/atualizar/cancelar o cliente e a assinatura reais no Asaas (`billingType: "UNDEFINED"`, que deixa o Asaas oferecer os meios habilitados na conta a cada cobrança) — mas **nunca bloqueiam** o usuário: qualquer falha (chave ausente, CPF/CNPJ ainda não informado, rede, resposta de erro) é logada de forma saneada e a função sempre volta para `NO_PAYMENT_PROVIDER`, exatamente o comportamento de antes. Decisão deliberada, não uma limitação esquecida: os métodos de escrita do Asaas nunca foram exercidos contra a API real (só a leitura foi), e tornar o cadastro de um Personal dependente, de forma bloqueante, de uma API externa ainda não comprovada seria repetir o erro de integração no escuro que este projeto sempre evitou.

Só tenta a ligação real com plano de preço real (`priceCents > 0`) e CPF/CNPJ já informado. Nesta mesma atualização, o gap ficou registrado por poucos minutos: inicialmente só `PersonalProfile` coletava CPF/CNPJ, deixando tenants `INDIVIDUAL` (FitOS Livre, plano pago real `individual-livre-v2`, R$19,90) inteiramente com `NO_PAYMENT_PROVIDER`. Murilo decidiu estender a mesma coleta ao `IndividualProfile` — mesmo tratamento (nullable, validação real por dígito verificador, obrigatório em toda nova submissão) — e `tryEnsureAsaasSubscription` (`src/modules/billing/subscriptions.ts`) foi generalizado para buscar o CPF/CNPJ em `PersonalProfile` ou `IndividualProfile` conforme `tenantType`.

**Ainda pendente**: confirmar o resultado real em homologação (mesmo padrão do diagnóstico original — ler os logs `[FIT-128][assinatura-asaas]`) antes de qualquer decisão de tornar esta ligação bloqueante; webhook de conciliação (ADR-010).
