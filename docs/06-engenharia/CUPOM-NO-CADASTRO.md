# Cupom de desconto no cadastro

Ao criar a conta (FitOS Livre ou personal), a pessoa pode informar um cupom. O desconto fica registrado na conta e vale nas próximas cobranças, como qualquer cupom resgatado em "Assinatura".

## Fluxo

1. **"Tem um cupom de desconto?"** fica no formulário de criação da conta e abre o campo.
2. **Aplicar** chama `POST /api/cupons/verificar` (público) com `{ code, product }`, antes de a conta existir.
   - O cupom precisa estar ativo, dentro da janela, valer para o produto e para **contas novas** (segmento `NOVOS`) e ainda ter vagas.
   - Cupons de contas escolhidas (`SELECIONADOS`), como os de convite do CRM, de amigo e de indicação, nunca valem digitados.
   - Com o cupom válido, a tela mostra o resumo do desconto.
3. **Código digitado sem "Aplicar"** bloqueia o envio, com um aviso para conferir ou apagar o código.
4. **Criar a conta** envia `couponCode` no onboarding (`/api/onboarding` ou `/api/onboarding-personal`). Depois que a assinatura existe, `redeemSignupCoupon` resgata o cupom.
   - O resgate é idempotente por conta: a chave é `cadastro-<tenant>`.
   - As regras do plano e da acumulação são as do resgate normal.
5. **Se não der para aplicar** (por exemplo, o plano escolhido não está no cupom, ou já há o desconto de um convite), a conta é criada mesmo assim. Um aviso diz o motivo, e a pessoa pode tentar de novo em Assinatura.

## Quando o campo não aparece

- `FEATURE_CUPONS` desligada.
- Cadastro do Livre por convite do CRM ou de amigo: o desconto já vem do convite, e os cupons não se somam.

O desconto só chega à cobrança do Asaas com `FEATURE_CUPONS_ASAAS=on`.
