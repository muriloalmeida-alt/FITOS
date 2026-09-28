# Runbook — verificação do checkout embutido de cartão no Asaas em homologação (FIT-128)

Documento autocontido para quem tem acesso direto ao Railway (Murilo ou seu GPT), mas não escreve no Git deste repositório. Nenhum passo aqui exige `git`/PR — é só completar um checkout real de cartão pela própria interface do FitOS e ler o log do próprio deploy, devolvendo o resultado saneado para Murilo/Claude continuarem o trabalho.

## Contexto (resumo, sem precisar ler o repositório)

- Projeto: FitOS. Épico: EPIC-16 (#148). História: FIT-128 — Integração real com Asaas (Issue #153).
- Já confirmado antes deste runbook: criação real de cliente/assinatura no Asaas Sandbox (ver `RUNBOOK-VERIFICACAO-ASSINATURA-REAL-ASAAS-HOMOLOGACAO.md`, concluído).
- **O que este runbook verifica**: decisão de Murilo — "toda a transação deve ocorrer no FitOS e o Asaas deve ser o gateway; o cliente deve completar 100% do processo de checkout" — implementada como um formulário de cartão dentro do próprio FitOS (nunca um redirecionamento para o Asaas). O cartão é **tokenizado** (`POST /v3/creditCard/tokenize`) e vinculado à assinatura (nenhuma cobrança acontece nesse momento — só quando o trial de 30 dias terminar). Este é o primeiro método de escrita do Asaas envolvendo dado de cartão real de teste, nunca exercido contra a API real ainda.
- **Nunca bloqueante para o resto da aplicação**: se o checkout de cartão falhar, o cadastro/onboarding já concluído (perfil + seleção de plano) não é desfeito — só o cartão não fica cadastrado, e a pessoa pode tentar de novo em `/painel/assinatura`.

## Escopo autorizado (não ultrapassar)

- Só o environment de **homologação** do Railway (`fitos-web-hml`) e a conta **Sandbox** do Asaas — nunca produção.
- Usar **exclusivamente um dos números de cartão de teste públicos do próprio Asaas Sandbox** (documentados no painel/documentação do Asaas para testes — geralmente uma bandeira Visa/Mastercard com um CVV/validade quaisquer futuros) — **nunca um cartão real**, nem mesmo um cartão de teste genérico de outro gateway, já que o Sandbox do Asaas pode ter suas próprias regras de aceitação.
- CEP, número de endereço e celular: qualquer dado fictício plausível (ex.: CEP `01310-100`, número `100`, celular de teste).
- Continuar usando a assinatura de teste já criada no runbook anterior, ou criar uma nova conta de teste do zero.

## Passo a passo

1. Acesse a URL pública de homologação do FitOS e faça login com a conta de teste (ou crie uma nova, seguindo `/comecar` → "Sou Personal" ou "Treinar sozinho").
2. Se estiver no onboarding: avance até a Etapa de "Escolha seu plano", selecione um **plano pago**. A tela seguinte ("Dados de pagamento") já pede o cartão — preencha com um número de cartão de teste do Asaas Sandbox, validade futura qualquer, CVV qualquer, e o CEP/número/celular fictícios.
3. Se já tiver uma conta com plano pago contratado (sem cartão ainda): acesse `/painel/assinatura` — a seção "Cartão de cobrança" já aparece com o formulário aberto.
4. Conclua o envio (botão "Concluir"/"Salvar cartão").
5. Abra os logs do serviço `fitos-web-hml` no environment de homologação, no momento da submissão.
6. Procure por uma linha começando com `[FIT-128][checkout-cartao]`:
   - `[FIT-128][checkout-cartao] sucesso: cartão tokenizado e vinculado à assinatura real no Asaas Sandbox.` — funcionou.
   - `[FIT-128][checkout-cartao] falha: kind=resposta_de_erro status=<N> codigo=<...> mensagem=<...>` — o Asaas recusou o cartão ou os dados (código/mensagem já saneados, seguros para colar — nunca incluem o número do cartão).
   - `[FIT-128][checkout-cartao] falha: kind=erro_de_rede ...` — falha de conexão antes de qualquer resposta do Asaas.
7. Na própria interface do FitOS, confirme que a submissão foi aceita (sem mensagem de erro) e que `/painel/assinatura` passa a mostrar "Cartão terminado em ####" com a bandeira do cartão de teste usado.
8. (Opcional, recomendado) No painel do Asaas Sandbox, na tela do cliente criado no runbook anterior, confirme que agora existe um cartão tokenizado associado a ele.

## O que devolver a Murilo/Claude ao final

- A linha de log completa (ou a ausência de qualquer linha `[FIT-128][checkout-cartao]`, se for o caso).
- Se `/painel/assinatura` passou a mostrar o cartão mascarado corretamente.
- Qual cartão de teste do Asaas Sandbox foi usado (só a bandeira, nunca o número completo).
- Confirmação explícita de que nenhum cartão real foi usado.

Com isso, o Claude decide o próximo passo: se o checkout de cartão funcionar como esperado, essa parte da prova técnica obrigatória do Asaas fica confirmada de ponta a ponta. Se falhar, o código/causa exata já vem no próprio log saneado. De qualquer forma, Apple Pay/Google Pay continuam como pendência separada (depende de confirmar se o Asaas oferece algum caminho de API para isso, fora do checkout hospedado dele).
