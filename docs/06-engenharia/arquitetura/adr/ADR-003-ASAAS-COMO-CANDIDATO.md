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

## Atualização — criação de cliente/assinatura confirmada empiricamente; catálogo vazio por override no Railway (FIT-128, 28/09/2026)

Achado real ao seguir o runbook em homologação: nenhum plano pago aparecia no onboarding. Causa raiz não era o código, era o pipeline de deploy — `railway.json` foi corrigido no PR #166 (seed do catálogo no pré-deploy), mas o serviço `fitos-web-hml` tinha um **"Pre-Deploy Command" configurado manualmente no painel do Railway**, sobrepondo silenciosamente o arquivo versionado desde a FIT-008. Corrigido por Murilo diretamente no painel (fora do Git) — detalhe completo em `AMBIENTES-E-DEPLOY.md` e no diário.

Com o catálogo corrigido, o runbook foi concluído até o fim: cadastro real de teste (Personal, CPF de teste válido, plano pago) produziu, confirmado por dois canais independentes — painel do Asaas Sandbox (cliente "Espaço de Master" visível em "Meus Clientes") e log da aplicação (`[FIT-128][assinatura-asaas] sucesso: cliente e assinatura ligados ao Asaas Sandbox.`) — um cliente e uma assinatura reais no Asaas Sandbox. **A primeira linha da prova técnica obrigatória (`ASSINATURA-SAAS.md`: "criar cliente e assinatura com dados fictícios") está confirmada.**

Ainda **`Proposto — condicionado à prova técnica`**, não `Aceito`: as demais linhas da prova (renovação, falha/inadimplência/recuperação, cancelamento, reconciliação, meios de pagamento reais disponíveis à conta, custo/compatibilidade Railway) continuam não exercidas.

## Atualização — webhook de conciliação implementado, ADR-010 item (c) (FIT-128, 28/09/2026)

`POST /api/webhooks/asaas` (`src/app/api/webhooks/asaas/route.ts`) recebe eventos de pagamento e reconcilia `SaasSubscription.status` (`src/modules/billing/asaasWebhook.ts`). Segue o contrato público documentado do Asaas v3 (header de autenticação `asaas-access-token`, formato `{event, payment: {id, subscription, customer}}`) — **ainda não exercido contra uma entrega real do Asaas**, mesma cautela usada para o cliente de escrita antes de ser confirmado (que, quando testado, bateu com a documentação pública). Detalhe completo em `ASSINATURA-SAAS.md`; verificação real pendente em `RUNBOOK-VERIFICACAO-WEBHOOK-ASAAS-HOMOLOGACAO.md`.

Com isso, os itens (a), (b) e (c) da ADR-010 estão implementados — (a) e a criação real de cliente/assinatura já confirmadas empiricamente; o webhook (c), ainda não. Webhook de conciliação não está mais "não iniciado" como as atualizações anteriores registravam.

## Atualização — checkout embutido no FitOS: cartão de crédito implementado (FIT-128, 28/09/2026)

Murilo decidiu que o checkout deve ocorrer inteiramente dentro do FitOS — "toda a transação deve ocorrer no FitOS e o Asaas deve ser o gateway. No FitOS o cliente deve completar 100% do processo de checkout" — nunca um redirecionamento para uma página hospedada pelo Asaas (o padrão de integração mais simples, mas explicitamente rejeitado). Meios de pagamento decididos para esta v1: cartão de crédito, mais Apple Pay/Google Pay como atalho para o mesmo cartão; Pix e boleto ficam fora do escopo.

**Cartão de crédito implementado**: `attachCreditCardToSubscription` (`src/modules/billing/checkout.ts`) tokeniza o cartão (`POST /v3/creditCard/tokenize`) e o vincula à assinatura já criada pela ligação de melhor esforço (`updateAsaasSubscription`, `billingType: "CREDIT_CARD"` + `creditCardToken`) — a partir daí, o Asaas cobra esse cartão automaticamente a cada vencimento. O cartão só é tokenizado no checkout, nunca cobrado nesse momento (a cobrança real continua só ao fim do trial de 30 dias). Segue o contrato público documentado do Asaas v3 — **ainda não exercido contra uma entrega real do Asaas**, mesma cautela de sempre; verificação pendente em `RUNBOOK-VERIFICACAO-CHECKOUT-CARTAO-ASAAS-HOMOLOGACAO.md`.

**Apple Pay/Google Pay, deliberadamente não construídos ainda**: sem confirmação de que a API do Asaas aceita esses tokens fora do checkout hospedado dele, implementar essa integração agora seria adivinhar um contrato não verificado — exatamente o tipo de "integração no escuro" que este projeto sempre evitou. Registrado como pendência explícita, a resolver depois que Murilo/seu GPT confirmarem com o suporte/documentação real do Asaas se existe esse caminho.

Detalhe completo em `ASSINATURA-SAAS.md` e no diário.
