# Cobrança do aluno pelo app (conta Asaas do personal)

Decisão (05/10/2026): o aluno paga **direto para o personal**. O FitOS não recebe nem repassa dinheiro; ele usa a conta Asaas do próprio personal.

## Como funciona

1. **Conectar** — em Configurações › Receber pelo app, o personal cola a chave de API da conta Asaas dele. O FitOS:
   - valida a chave (`GET /customers`);
   - detecta o ambiente pela chave (`_hmlg_` = sandbox; senão produção);
   - cadastra na conta dele um webhook `POST {BETTER_AUTH_URL}/api/webhooks/asaas-personal/{token}` com `authToken` próprio (eventos `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED`, `PAYMENT_DELETED`);
   - guarda a chave **criptografada** (`payment_accounts.apiKeyEncrypted`).
2. **Cobrar** — no Financeiro, "Cobrar" numa mensalidade em aberto cria o cliente (CPF do aluno, pedido uma vez) e a cobrança `billingType: UNDEFINED` (o aluno escolhe Pix, boleto ou cartão). O link (`invoiceUrl`) e o Pix copia e cola vão por WhatsApp; o aluno também vê "Pagar" no Início.
3. **Baixa automática** — o webhook confere o token da URL e o cabeçalho `asaas-access-token` e registra o pagamento (forma Pix/Boleto/Cartão).
4. **Sem cobrança dupla** — cancelar a mensalidade ou registrar o pagamento à mão remove a cobrança no Asaas.
5. **Desconectar** (ou excluir a conta) remove o webhook da conta do personal.

## Configuração

- `PAYMENT_KEYS_SECRET` (opcional, recomendado em produção): chave usada para criptografar as chaves de API. Sem ela, usa `BETTER_AUTH_SECRET` — trocar esse segredo depois invalida as chaves guardadas (o personal precisa conectar de novo).
- `BETTER_AUTH_URL` precisa ser a URL pública do ambiente, porque é a base do webhook cadastrado na conta do personal.

## Limites conhecidos

- Não testado contra o Asaas real a partir do ambiente de desenvolvimento (sem rede para o Asaas); os testes usam um Asaas simulado.
- Reembolso/estorno no Asaas não desfaz a baixa no FitOS (use "Desfazer" no Financeiro).
