# Runbook — gratuidade do administrador com cobrança no Asaas (homologação)

Feature 4 (Renovação de gratuidade), fatia 3. ADR-017. O código foi testado com respostas simuladas do Asaas, porque o ambiente de desenvolvimento não alcança o sandbox. Este runbook confirma o comportamento contra o **Asaas Sandbox** antes de ligar em produção.

## Escopo autorizado

- Só homologação do Railway (`fitos-web-hml`) e conta **Sandbox** do Asaas. Nunca produção.
- Dados fictícios (CPF de teste `111.444.777-35`).

## Preparação

1. No serviço `fitos-web-hml`, defina `GRATUIDADE_ASAAS=on` (sem imprimir outros valores) e faça o redeploy.
2. Crie uma conta de teste (Personal ou FitOS Livre) com plano pago e CPF de teste, e confirme no log `[FIT-128][assinatura-asaas] sucesso`. A assinatura agora existe no Sandbox.
3. No painel do Asaas Sandbox, anote a **próxima cobrança** dessa assinatura (Assinaturas → detalhe).

## Caso 1 — adiamento da próxima cobrança

1. Entre como administrador, abra Administração → Usuários → a conta de teste → Benefícios.
2. Escolha +30 dias, motivo Suporte, **Revisar**. A linha "Cobrança" deve dizer `Asaas: a próxima cobrança passa de DD/MM/AAAA para DD/MM/AAAA`.
3. **Confirmar gratuidade.** O histórico deve mostrar "Agendado" ou "Em vigor" e `Asaas: próxima cobrança em …`.
4. No Asaas Sandbox, a próxima cobrança da assinatura deve ser a data nova. Cobranças já emitidas não mudam.
5. No log, procure `gratuidade_asaas_sincronizacao` com `"state":"ACTIVE"`.

## Caso 2 — cobrança já emitida bloqueia

1. No Asaas Sandbox, gere ou deixe pendente uma cobrança da assinatura com vencimento dentro da próxima janela.
2. Na prévia, deve aparecer: `Já existe cobrança emitida dentro da janela gratuita: …`. Nada é alterado no Asaas.

## Caso 3 — sem chave ou Asaas fora

- Sem `API_ASAAS`, a prévia mostra `Não foi possível consultar a assinatura no Asaas agora`.

## O que devolver

- Os textos da linha "Cobrança" da revisão e do histórico.
- A próxima cobrança vista no Sandbox antes e depois.
- As linhas `gratuidade_asaas_sincronizacao` / `gratuidade_asaas_leitura_falhou` do log (já não contêm chave nem dado de cliente).

Se o Asaas recusar o `PUT /v3/subscriptions/{id}` com `nextDueDate`, a concessão fica "Falhou" no histórico e o acesso existente não muda. Devolva a mensagem de erro do histórico.
