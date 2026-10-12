# Checklist para entrar em produção

Situação em 12/10/2026. Marque cada item quando estiver feito.

## 1. Código

- [x] Assinatura do FitOS no Asaas de produção: `ASAAS_BASE_URL` vale para a assinatura e para a cobrança dos alunos. Antes, a assinatura estava fixa no Sandbox.
- [x] "Esqueci minha senha" com e-mail pelo Resend (EPIC-24).

## 2. Railway: ambiente de produção

- [ ] Ambiente `production` com **banco próprio**. Nada de homologação é reaproveitado.
- [ ] Backup do PostgreSQL: o plano Hobby não tem backup automático. Subir de plano ou configurar backup diário.
- [ ] App em **`app.fitosx.com.br`** (decisão de 12/10/2026; DNS no Registro.br):
  - no Railway: Settings → Networking → Custom Domain;
  - no Registro.br: o registro CNAME `app` que o Railway indicar;
  - `BETTER_AUTH_URL=https://app.fitosx.com.br`.

  A raiz `fitosx.com.br` fica livre para um site.
- [ ] Orçamento e alertas de consumo.
- [ ] Variáveis com valores **novos**, nunca copiados de homologação:

| Variável | Valor em produção |
|---|---|
| `DATABASE_URL` | banco de produção |
| `BETTER_AUTH_SECRET`, `PAYMENT_KEYS_SECRET` | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | `https://app.fitosx.com.br` |
| `NEXT_PUBLIC_APP_ENV` | `production` |
| `API_ASAAS` | chave de **produção** do Asaas |
| `ASAAS_BASE_URL` | `https://api.asaas.com/v3` |
| `ASAAS_WALLET_ID` | carteira do FitOS (recebe os 2%) |
| `API_ASAAS_WEBHOOK_TOKEN` | segredo novo, igual ao cadastrado no webhook do painel Asaas |
| `RESEND_API_KEY`, `EMAIL_FROM` | chave do Resend e remetente do domínio verificado |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | par novo (`npm run push:chaves`) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | conta do administrador |
| `R2_PUBLIC_BASE_URL` | a mesma do catálogo (imagens públicas) |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | projeto Sentry de produção (recomendado) |

- [ ] Primeiro deploy: tudo roda sozinho (`preDeployCommand`), nesta ordem:
  - migrations;
  - catálogo de exercícios (`catalog:garantir`): num banco novo, carrega o catálogo curado e reaplica os ajustes de imagens, aeróbicos e Funcional. No log: "274 exercício(s)…";
  - planos comerciais;
  - conta de administrador.

## 3. Asaas

- [ ] Conta de produção aprovada, com a conta bancária do FitOS.
- [ ] Webhook de produção apontando para `https://app.fitosx.com.br/api/webhooks/asaas`, com o token.
- [ ] Runbooks no Sandbox (`RUNBOOK-VERIFICACAO-*`): assinatura real, checkout com cartão, webhook, gratuidade e cupons.
- [ ] `GRATUIDADE_ASAAS=on` e `CUPONS_ASAAS=on`, só depois dos respectivos runbooks.

## 4. Resend

- [ ] Domínio `fitosx.com.br` verificado no Resend (registros DNS SPF/DKIM) e `EMAIL_FROM="FitOS <nao-responda@fitosx.com.br>"`.
- [ ] Teste: "Esqueci minha senha" com um e-mail real chega na caixa de entrada.

## 5. Decisões e jurídico

- [ ] Termos de uso e Política de privacidade revisados (retenção e exclusão, LGPD).
- [ ] Preços e teste grátis finais dos planos.

## 6. Lançamento

- [ ] Ensaio completo em produção com uma conta própria e um cartão real de valor baixo: cadastro, assinatura, webhook, recuperação de senha e cancelamento.
- [ ] Abrir para os clientes.
