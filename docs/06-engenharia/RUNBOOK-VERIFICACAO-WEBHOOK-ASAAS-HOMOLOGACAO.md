# Runbook — verificação do webhook de conciliação do Asaas em homologação (FIT-128, ADR-010 item (c))

Documento autocontido para quem tem acesso direto ao painel do Asaas e ao Railway (Murilo ou seu GPT), mas não escreve no Git deste repositório. Nenhum passo aqui exige `git`/PR — é configurar o webhook no painel do Asaas Sandbox, disparar um evento de teste e ler o log do próprio deploy, devolvendo o resultado saneado para Murilo/Claude continuarem o trabalho.

## Contexto (resumo, sem precisar ler o repositório)

- Projeto: FitOS. Épico: EPIC-16 (#148). História: FIT-128 — Integração real com Asaas (Issue #153), item (c) da ADR-010 (webhook/conciliação).
- Já confirmado antes deste runbook: criação real de cliente e assinatura no Asaas Sandbox (ver `RUNBOOK-VERIFICACAO-ASSINATURA-REAL-ASAAS-HOMOLOGACAO.md`, já concluído).
- **O que este runbook verifica**: se o FitOS consegue *receber* eventos do Asaas (pagamento recebido, pagamento em atraso) e atualizar o status local da assinatura (`SaasSubscription.status`) de acordo. Sem isso, o FitOS cria a assinatura mas nunca fica sabendo se ela foi paga, ficou inadimplente ou foi reembolsada — item (c) da ADR-010, até agora não implementado.
- **Nunca exercido contra uma entrega real do Asaas ainda**: a rota (`src/app/api/webhooks/asaas/route.ts`) e a lógica de reconciliação (`src/modules/billing/asaasWebhook.ts`) seguem o contrato público documentado do Asaas v3 (nome do header de autenticação `asaas-access-token`, formato do payload `{ event, payment: { id, subscription, customer } }`) — mesma cautela já usada para o cliente HTTP de escrita antes de ser confirmado. Este runbook é exatamente essa confirmação.
- **Nunca bloqueante para o resto da aplicação**: se o Asaas nunca chegar a entregar um evento, ou entregar em formato inesperado, nada no cadastro/troca/cancelamento de assinatura é afetado — esses fluxos não dependem do webhook para funcionar, só ficam sem a atualização automática de status.

## Escopo autorizado (não ultrapassar)

- Só o environment de **homologação** do Railway (`fitos-web-hml`) e a conta **Sandbox** do Asaas — nunca produção.
- Configurar o webhook do Asaas Sandbox apontando para `https://fitos-web-hml-homologacao.up.railway.app/api/webhooks/asaas` (confirme a URL pública atual no painel do Railway — pode ter mudado).
- Usar um **token de autenticação novo**, gerado só para este webhook (nunca a chave `API_ASAAS` já existente) — configurar o mesmo valor nos dois lados: no painel do Asaas (campo "Token de autenticação" da configuração do webhook) e na variável de ambiente `API_ASAAS_WEBHOOK_TOKEN` do serviço `fitos-web-hml` no Railway.
- Usar a assinatura de teste já criada no runbook anterior (cliente "Espaço de Master" ou equivalente) — nunca dado real.

## Passo a passo

1. No painel do Railway, no serviço `fitos-web-hml` (environment de homologação), configure a variável `API_ASAAS_WEBHOOK_TOKEN` com um valor aleatório longo (ex.: gerado por `openssl rand -hex 32` em qualquer terminal, ou qualquer gerador de senha longa). Guarde esse valor — vai ser usado no próximo passo. Redeploy o serviço se a variável não for aplicada automaticamente.
2. No painel do Asaas Sandbox: Configurações → Integrações → Webhooks (o caminho exato pode variar; procure por "Webhooks" ou "Notificações"). Crie um novo webhook:
   - URL: `https://fitos-web-hml-homologacao.up.railway.app/api/webhooks/asaas` (confirme a URL pública atual).
   - Eventos: selecione ao menos "Pagamento recebido"/"Pagamento confirmado" e "Pagamento vencido"/"Cobrança em atraso" (nomes exatos do payload: `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED`, `PAYMENT_OVERDUE`).
   - Token de autenticação: o mesmo valor gerado no passo 1.
   - Salve e, se o Asaas oferecer, envie um evento de teste pela própria interface (muitos painéis do Asaas têm um botão "Testar" ou "Enviar exemplo").
3. Se o painel do Asaas não tiver um botão de teste, force um evento real: usando a assinatura de teste já criada (ver runbook anterior), simule uma cobrança vencendo hoje (ou antecipe a data de vencimento no próprio painel do Asaas Sandbox, se a interface permitir) para gerar um `PAYMENT_OVERDUE` real, ou marque manualmente uma cobrança pendente como "recebida" no painel para gerar um `PAYMENT_RECEIVED`.
4. Abra os logs do serviço `fitos-web-hml` no environment de homologação, no momento em que o evento é entregue.
5. Procure por uma linha começando com `[FIT-128][webhook-asaas]`. Ela já vem pronta para copiar:
   - `[FIT-128][webhook-asaas] evento=PAYMENT_RECEIVED pagamento=<id> resultado=ATIVA_APLICADA` — a assinatura voltou/permaneceu `ATIVA`. Sucesso.
   - `[FIT-128][webhook-asaas] evento=PAYMENT_OVERDUE pagamento=<id> resultado=INADIMPLENTE_APLICADA` — a assinatura foi marcada `INADIMPLENTE`. Sucesso.
   - `resultado=IGNORADO_SEM_ASSINATURA_LOCAL` — o evento não corresponde a nenhuma assinatura conhecida do FitOS (ex.: evento de teste genérico do Asaas, sem `customer`/`subscription` reais). Não é um erro, mas relate se não era esperado.
   - `recusado: token de autenticação do webhook ausente ou inválido` — o token configurado no Asaas não bate com `API_ASAAS_WEBHOOK_TOKEN` no Railway. Confira se os dois valores são exatamente iguais.
   - `recusado: API_ASAAS_WEBHOOK_TOKEN não configurado neste ambiente` — a variável não foi criada/aplicada no Railway (voltar ao passo 1).
   - `recusado: formato de payload inesperado` — o Asaas enviou um formato diferente do documentado publicamente (achado real a reportar — significa que `asaasWebhook.ts` precisa de ajuste).
6. Confirme no painel `/painel/assinatura` do FitOS (login com a conta de teste) que o status exibido da assinatura reflete a mudança (ex.: "Inadimplente" depois de um `PAYMENT_OVERDUE`).
7. Copie a linha de log completa (já saneada, sem token/chave/dado de cliente) e devolva a Murilo/Claude.

## O que devolver a Murilo/Claude ao final

- A linha de log completa (ou a ausência de qualquer linha `[FIT-128][webhook-asaas]`, se for o caso).
- Se o status da assinatura em `/painel/assinatura` de fato mudou como esperado.
- Confirmação explícita de que nenhum dado real de cliente foi usado.

Com isso, o Claude decide o próximo passo: se o formato do payload real do Asaas bater com o documentado publicamente (o esperado), a peça (c) da ADR-010 fica confirmada de ponta a ponta — criação real (já confirmada) mais reconciliação real. Se o formato divergir, o achado já vem com a causa exata (a própria linha de log), sem precisar investigar no escuro.
