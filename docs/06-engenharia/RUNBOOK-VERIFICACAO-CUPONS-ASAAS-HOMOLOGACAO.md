# Runbook: cupom na cobrança do Asaas (homologação)

Este runbook cobre a feature 5 (Cupons de desconto), fatia 3, decidida no ADR-021.

O código foi testado com respostas simuladas do Asaas, porque o ambiente de desenvolvimento não alcança o sandbox. Este runbook confirma, contra o **Asaas Sandbox**, que o desconto entra na cobrança e que a assinatura não muda. Isso precisa ser feito antes de ligar `CUPONS_ASAAS` em produção.

## Escopo autorizado

- Só a homologação do Railway (`fitos-web-hml`) e uma conta **Sandbox** do Asaas. Nunca produção.
- Só dados fictícios (CPF de teste `111.444.777-35`).
- O webhook do Asaas já deve estar configurado (`RUNBOOK-VERIFICACAO-WEBHOOK-ASAAS-HOMOLOGACAO.md`), com os eventos de cobrança, **incluindo `PAYMENT_CREATED`**.

## Preparação

1. No serviço `fitos-web-hml`, defina `FEATURE_CUPONS=on` e `CUPONS_ASAAS=on` (sem imprimir outros valores) e faça o redeploy.
2. Crie uma conta de teste (Personal ou FitOS Livre) com plano pago e CPF de teste. Confirme no log `[FIT-128][assinatura-asaas] sucesso`.
3. Entre como administrador e crie, em Administração → Cupons, um cupom de **20% por 2 ciclos** para Novos e para o plano da conta. Ative o cupom.
4. Entre com a conta de teste, abra Assinatura → "Tem um cupom?", aplique o código e confirme.

## Caso 1: desconto na cobrança criada

1. No Asaas Sandbox, deixe a assinatura gerar a próxima cobrança, ou antecipe a geração pelo painel.
2. O webhook `PAYMENT_CREATED` chega. No log, procure `evento=PAYMENT_CREATED` e confira que não aparece `cupons.cobranca_ajuste_falhou`.
3. No Sandbox:
   - a **cobrança** deve mostrar o valor com desconto (ex.: R$ 49,90 → R$ 39,92);
   - a **assinatura** deve continuar com o valor cheio.
4. Pague a cobrança no Sandbox (Receber em dinheiro, ou cartão de teste). Em Assinatura → Cupons, a conta deve mostrar "1 de 2 cobranças com desconto".

## Caso 2: depois dos ciclos

1. Repita o caso 1 para a segunda cobrança. O cupom deve aparecer como "Encerrado".
2. A terceira cobrança gerada deve vir **cheia**. Não há nada a restaurar na assinatura.

## Caso 3: cobrança já paga ou cartão capturado

- Se o Sandbox capturar o cartão no momento em que cria a cobrança, a cobrança chega como paga. O FitOS não muda o valor dela e o cupom **não** consome ciclo.
- Anote se isso acontece com cartão. Esse é o ponto principal a validar para cartão de crédito.

## O que devolver

- Valores da cobrança e da assinatura no Sandbox, antes e depois.
- As linhas do log `evento=PAYMENT_CREATED`, `cupons.cobranca_ajuste_falhou` e `cupons.reconciliacao`. Elas não contêm chave nem dado de cliente.
- O texto de Assinatura → Cupons depois de cada pagamento.

## Se o Asaas recusar

Se o Asaas recusar o `PUT /v3/payments/{id}` com `value`:
- a aplicação fica com `status = FAILED` depois de 3 tentativas;
- a cobrança continua cheia;
- o cupom não perde ciclo.

Nesse caso, devolva o `lastError` da tabela `coupon_cycle_applications`.
