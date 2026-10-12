# Indicação de amigos — FitOS Livre

Aluno do FitOS Livre convida amigos pelo próprio link e ganha desconto quando um deles assina.

## Regras

| Quem | Ganha | Quando |
| --- | --- | --- |
| Amigo convidado | 50% no primeiro mês depois do teste grátis (como no CRM) | No cadastro pelo link |
| Quem convidou | 10% na próxima mensalidade | Quando o amigo paga a primeira vez |

- **Não acumula.** Enquanto houver um desconto de indicação de 10% por usar, novas indicações confirmadas não somam outro. Convidar 1 ou 10 amigos dá o mesmo desconto. Depois que o desconto é usado, a próxima indicação confirmada vale de novo.
- Só vale de Livre para Livre. O link de um personal continua levando ao cadastro de personal, com as regras da indicação de personal (EPIC-47).
- Não vale para a própria conta, para conta criada há mais de 7 dias nem para quem entrou por um convite do CRM. O convite do CRM vem antes e os dois não se somam.

## Como funciona

1. **Perfil → Convide amigos → Convidar.** Abre o menu de compartilhar do celular (WhatsApp, Mensagens...) com o link `/i/<código>`. No computador, o link é copiado.
2. **`/i/<código>`** guarda o código no cookie `fitos_indicacao` por 60 dias e leva ao cadastro do Livre (`/comecar?caminho=livre&indicado=1`), que mostra o aviso do desconto.
3. **Cadastro (`/api/onboarding`).**
   - Liga as contas (`personal_referrals`, a mesma tabela da indicação de personal).
   - Cria o cupom `AMIGO-XXXXXX`: 50%, um ciclo mensal, uso único, só para a conta nova.
   - Resgata o cupom na conta nova.
4. **Primeiro pagamento do amigo (webhook do Asaas, `rewardReferrer`).**
   - Cria o cupom `INDICA-XXXXXX`: 10%, um ciclo mensal, só para quem convidou.
   - Resgata o cupom na conta de quem convidou e avisa essa pessoa pelo celular.
   - Se outro cupom que não combina estiver em vigor (por exemplo, os 50% de amigo dessa própria pessoa), o prêmio fica para o próximo pagamento do amigo.

Os cupons são criados pelo ator `sistema:indicacao` e aparecem na lista de cupons do admin. Os helpers ficam em `modules/billing/autoCoupons.ts` (também usados pelo CRM).

## Dependências

- `FEATURE_CUPONS` desligada esconde o convite no perfil.
- O desconto só é aplicado na cobrança do Asaas com `FEATURE_CUPONS_ASAAS=on`. Antes de ligar, siga o `RUNBOOK-VERIFICACAO-CUPONS-ASAAS-HOMOLOGACAO.md`.
- Planos: só os planos mensais pagos do Livre. Quem está no plano anual não recebe os 10%; o caso fica registrado no log.
