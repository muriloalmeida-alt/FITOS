# CRM de convites (admin)

Convida futuros clientes do **FitOS Livre** pelo WhatsApp com a mensagem padrão "Conheça o FitOS". O benefício é de 30 dias grátis (o teste do plano) e, depois, **50% de desconto nos 30 dias seguintes**, com um cupom próprio de cada contato.

## Onde

- Tela: Administração → **CRM** (`/painel/admin/crm`). Aparece junto com Cupons; depende de `FEATURE_CUPONS`, ligada por padrão. Nenhuma `FEATURE_` nova.
- Código:
  - regras puras em `src/shared/lib/crm.ts`;
  - servidor em `src/modules/crm/prospects.ts`;
  - rotas em `/api/admin/crm` (cadastro), `/lote` (importação), `/[id]/enviado` e `/[id]/descartar`.

## Contatos

- **Individual**: nome, celular (WhatsApp), e-mail e observação opcionais.
- **Em lote**: lista colada ou arquivo `.csv`, uma pessoa por linha (`Nome; celular; e-mail`), com separador `;`, `,` ou tab, até 200 por vez.
  - Celular já cadastrado no CRM é pulado e informado.
  - Linhas inválidas voltam com o motivo.
- O celular é normalizado (`5511987654321`) e cada número entra uma única vez.

## Cupom por contato

Cada contato ganha, ao ser cadastrado, um cupom **criado e ativado automaticamente** (`CONHECA-XXXXXX`):
- 50% (5000 bps) por **1 ciclo**, nos planos **mensais pagos do FitOS Livre**;
- público **Novos**, uso único (`maxRedemptions` 1, 1 por conta), não acumulável.

O cupom aparece em Administração → Cupons como qualquer campanha. Descartar o contato encerra o cupom.

## Envio (link wa.me)

- **Sem API do WhatsApp**: cada toque em "Enviar no WhatsApp" abre a conversa com o contato e a mensagem pronta, e o admin confirma o envio no WhatsApp.
- **Fila de envio**: mostra o próximo contato novo e anda sozinha depois de cada toque.
- **Contagem**: o toque registra o envio (`CONVIDADO`, número de envios e data).

## Link e cadastro

- `GET /conheca/{token}` registra a primeira abertura (`ABERTO`), guarda o convite no cookie `fitos_convite` (60 dias, httpOnly) e leva ao cadastro do Livre.
- O cadastro mostra o benefício do convite.
- **Na conclusão do onboarding do Livre**:
  - o contato passa a `CADASTRADO` com a conta;
  - **o cupom é resgatado na conta nova** (resgate idempotente por contato);
  - o cookie é apagado.
  - Falha no cupom fica no log e nunca derruba o cadastro.
- **Links que não valem**: desconhecido, descartado ou já usado leva à apresentação (`/conheca`), sem cupom.
- **Quem não usa o convite**: outra conta não usa o convite de quem já se cadastrou, e personal não usa convite do Livre.

## Cobrança

O resgate fica registrado e aparece em Assinatura → Cupons. O desconto só entra nas cobranças do Asaas com `FEATURE_CUPONS_ASAAS` ligada (ver o runbook de cupons). Sem ela, o cupom fica "em vigor", mas a cobrança sai cheia.
