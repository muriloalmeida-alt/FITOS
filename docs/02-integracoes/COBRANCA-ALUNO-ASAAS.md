# Cobrança do aluno pelo app (subconta Asaas do personal)

Decisões (06/10/2026):
- O personal **não entra no Asaas**. O FitOS cria, pela API da conta principal, uma **subconta** em nome dele.
- O FitOS fica com **2%** de cada mensalidade paga (split).
- O fluxo anterior, em que o personal colava a chave de API, foi removido.

## Como funciona

1. **Ativar** — em Configurações › Receber pelo app, o personal preenche:
   - CPF/CNPJ e nascimento (CPF) ou tipo da empresa (CNPJ);
   - celular;
   - endereço (o CEP preenche rua e bairro pelo ViaCEP);
   - renda mensal;
   - a chave Pix dos saques.

   O FitOS chama `POST /v3/accounts` com a chave principal (`API_ASAAS`) e já cadastra o webhook da subconta. A chave da subconta é devolvida pelo Asaas e guardada **criptografada**.
2. **Verificação de identidade** — o Asaas aprova cada subconta. O FitOS mostra o link `onboardingUrl` (documento e selfie) e acompanha a situação:
   - pelo aviso `ACCOUNT_STATUS_GENERAL_APPROVAL_*`;
   - e por `GET /myAccount/status`, no máximo a cada 10 min.

   Até a aprovação já dá para cobrar; o saque só libera depois.
3. **Cobrar** — no Financeiro, "Cobrar" cria o cliente (CPF do aluno, pedido uma vez) e a cobrança `billingType: UNDEFINED` (Pix, boleto ou cartão). Cada cobrança leva `split: [{ walletId: <carteira do FitOS>, percentualValue: 2 }]`. O link e o Pix copia e cola vão por WhatsApp, e o aluno vê "Pagar" no Início.
4. **Baixa automática** — o webhook (`/api/webhooks/asaas-personal/{token}`, cabeçalho `asaas-access-token`) registra o pagamento.
5. **Saldo e saque** — Configurações mostra o saldo (`GET /finance/balance`). "Sacar" faz `POST /transfers` por Pix para a chave do personal, só com a conta aprovada.
6. **Sem cobrança dupla** — cancelar a mensalidade ou registrar o pagamento à mão remove a cobrança no Asaas.

## Configuração (Railway)

| Variável | Para quê |
|---|---|
| `API_ASAAS` | Chave da conta principal do FitOS (cria as subcontas). |
| `ASAAS_BASE_URL` | `https://api.asaas.com/v3` em produção; sem ela, usa o sandbox. |
| `ASAAS_WALLET_ID` | Carteira do FitOS que recebe os 2% (sem ela, é buscada em `GET /wallets`). |
| `PAYMENT_KEYS_SECRET` | Criptografia das chaves das subcontas (sem ela, usa `BETTER_AUTH_SECRET`; trocar esse segredo invalida as chaves guardadas). |
| `BETTER_AUTH_URL` | URL pública: base do webhook cadastrado em cada subconta. |

A conta principal do FitOS precisa estar **liberada pelo Asaas para criar subcontas** (confirmar com o comercial; white label pode exigir acordo).

## Limites conhecidos

- Não testado contra o Asaas real a partir do ambiente de desenvolvimento (sem rede); os testes usam um Asaas simulado com as rotas e campos da documentação pública. Confirmar os campos de `POST /accounts` e dos documentos no sandbox antes de produção.
- Reembolso/estorno no Asaas não desfaz a baixa no FitOS (use "Desfazer" no Financeiro).
- Excluir a conta no FitOS remove o vínculo; a subconta e o saldo continuam no Asaas.
