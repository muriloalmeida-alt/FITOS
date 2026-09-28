# Runbook — verificação da ligação real de assinatura ao Asaas em homologação (FIT-128)

Documento autocontido para quem tem acesso direto ao Railway (painel ou GPT com acesso), mas não escreve no Git deste repositório. Nenhum passo aqui exige `git`/PR — é só executar um fluxo real na interface e ler o log do próprio deploy, devolvendo o resultado saneado (sem chave, sem dado de cliente) para Murilo/Claude continuarem o trabalho.

## Contexto (resumo, sem precisar ler o repositório)

- Projeto: FitOS. Épico: EPIC-16 (#148). História: FIT-128 — Integração real com Asaas (Issue #153).
- Já confirmado antes deste runbook: conectividade e autenticação com o Asaas Sandbox (diagnóstico temporário, já removido) e CPF/CNPJ agora coletado no onboarding do Personal e do FitOS Livre.
- **O que ainda não foi confirmado**: se `subscribeTenantToPlan` (chamada na conclusão do onboarding, ou ao trocar de plano em `/painel/assinatura`) de fato consegue criar um cliente e uma assinatura reais no Asaas Sandbox. O código (`src/modules/billing/subscriptions.ts`, função `tryEnsureAsaasSubscription`) segue o contrato público documentado do Asaas v3, mas os métodos de escrita (`POST /customers`, `POST /subscriptions`) nunca foram exercidos contra a API real — só a leitura (`GET /customers`) foi.
- **A ligação é em modo de melhor esforço, nunca bloqueante**: se falhar por qualquer motivo, o cadastro/troca de plano continua funcionando normalmente (assinatura fica com `provider = "sem_integracao"`, exatamente como antes desta História). Este runbook serve só para **ler o resultado**, nunca para desbloquear nada.

## Escopo autorizado (não ultrapassar)

- Só o environment de **homologação** do Railway (serviços `fitos-web-hml`/`fitos-postgres-hml`) e a conta **Sandbox** do Asaas — nunca produção, nunca chave de produção.
- Usar **dados fictícios** para o cadastro de teste: nome de teste, e-mail de teste, e um CPF matematicamente válido mas de teste, por exemplo `111.444.777-35` (amplamente conhecido como exemplo público de validação, nunca um documento real).
- Escolher um **plano pago** (qualquer plano com preço maior que zero — hoje `personal-20`/`personal-50`/`personal-ilimitado-v2` para Personal, ou `individual-livre-v2` para o FitOS Livre). Um plano de preço zero nunca tenta a ligação real (nada a cobrar).
- Nunca captar dados de cartão/Pix reais — o Asaas Sandbox nunca processa cobrança real, mesmo que o fluxo chegasse a uma tela de pagamento (o que hoje não acontece: o FitOS ainda não redireciona para nenhum checkout, só cria a assinatura).

## Passo a passo

1. Acesse a URL pública de homologação do FitOS (`fitos-web-hml`, painel do Railway tem o link).
2. Crie uma conta de teste nova — como Personal (`/comecar` → "Sou Personal") ou como FitOS Livre (`/comecar` → "Treinar sozinho"). Complete o onboarding até o fim:
   - Personal: informe celular, o CPF de teste `111.444.777-35`, faixa de alunos, nome do espaço, escolha um **plano pago** (não o trial gratuito — todos os planos atuais têm 30 dias de trial antes da primeira cobrança, mas a assinatura já é criada na hora, mesmo durante o trial).
   - FitOS Livre: informe objetivo/experiência/disponibilidade, o mesmo CPF de teste, escolha o plano `individual-livre-v2`.
3. Aceite os termos e conclua.
4. Abra os logs do serviço `fitos-web-hml` no environment de homologação, no momento imediatamente após a conclusão do onboarding (a tentativa de ligação ao Asaas acontece de forma síncrona, antes da resposta da própria requisição de conclusão).
5. Procure por uma linha começando com `[FIT-128][assinatura-asaas]`. Ela já vem pronta para copiar — é exatamente o que precisa ser reportado, sem nenhuma edição:
   - `[FIT-128][assinatura-asaas] sucesso: cliente e assinatura ligados ao Asaas Sandbox.` — a ligação real funcionou.
   - `[FIT-128][assinatura-asaas] falha: kind=resposta_de_erro status=<N> codigo=<...> mensagem=<...>` — o Asaas respondeu com um erro (código/mensagem já saneados pelo próprio código, seguros para colar).
   - `[FIT-128][assinatura-asaas] falha: kind=erro_de_rede status=- codigo=- mensagem=<categoria>` — falha de DNS/TLS/conexão/timeout antes de qualquer resposta HTTP.
   - `[FIT-128][assinatura-asaas] pulado: CPF/CNPJ ainda não informado para este tenant.` — não deveria aparecer se o CPF de teste foi preenchido corretamente; se aparecer, é um sinal de que o dado não foi salvo (achado a reportar).
   - Nenhuma linha `[FIT-128][assinatura-asaas]` sequer: a variável `API_ASAAS` pode estar ausente neste ambiente (confirme no painel do Railway, sem imprimir o valor), ou o plano escolhido tinha preço zero.
6. Copie essa linha (ela já não contém a chave, headers ou dado de cliente) e devolva a Murilo/Claude.

## Verificação cruzada (opcional, recomendada em caso de sucesso)

Se o log disser "sucesso", confirme no próprio painel do Asaas Sandbox (conta de teste) que:

- Um novo cliente aparece em "Clientes", com o CPF de teste usado.
- Uma nova assinatura aparece em "Assinaturas", vinculada a esse cliente, com o valor e ciclo do plano escolhido.

Isso não é obrigatório para reportar o resultado, mas fecha o ciclo de confiança sem depender só do log da aplicação.

## O que devolver a Murilo/Claude ao final

- A linha de log completa (ou a ausência de qualquer linha `[FIT-128][assinatura-asaas]`, se for o caso).
- Se fez a verificação cruzada no painel do Asaas: se o cliente/assinatura realmente apareceram lá, com o valor esperado.
- Confirmação explícita de que nenhum dado real de cliente foi usado e nenhuma cobrança de produção ocorreu.

Com isso, o Claude decide o próximo passo com segurança: se a ligação real funcionar como esperado, considerar promovê-la de "melhor esforço" para uma etapa mais confiável (ou manter como está, se não houver necessidade); se falhar, o código/causa exata já estará identificado pelo próprio log saneado, sem precisar investigar no escuro. De qualquer forma, o webhook de conciliação (ADR-010, item c) — para saber quando uma cobrança real é paga, falha ou atrasa — continua sendo o próximo trabalho de código, ainda não iniciado.
