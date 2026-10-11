# ADR-017 — Gratuidade concedida pelo administrador: benefício separado do teste e da cobrança

Status: **Aceito** (feature 4 — Renovação de gratuidade, fatia 1)
Data: 11 de outubro de 2026

## Contexto

O administrador precisa conceder dias de acesso gratuito a personais e a praticantes FitOS Livre (dono de tenant `INDIVIDUAL`). Hoje o acesso depende só de `SaasSubscription.trialEndsAt` (`billing/access.ts`): fim do teste sem cartão, 3 dias de carência e bloqueio. `trialUsedAt` marca para sempre que o tenant já teve teste (EPIC-16) e não pode ser zerado. A cobrança real no Asaas tem cronograma próprio (`nextDueDate`) que não muda só porque o acesso local mudou.

## Decisões

1. **Benefício é uma entidade própria, `AdministrativeAccessGrant`**, ligada ao tenant e à assinatura. `trialEndsAt` e `trialUsedAt` nunca mudam. O histórico é imutável: a concessão nunca é editada, e a revogação é outro evento, com motivo, que muda o estado para `REVOKED`.
2. **Acesso e cobrança são dimensões separadas.** `subscriptionAccess` recebe as janelas ativas e libera enquanto alguma cobre o instante atual. A carência conta do fim do último acesso promocional (teste ou benefício). `nextChargeDate` recebe `freeUntil`: a próxima cobrança local (e os avisos de vencimento) passa para o fim do benefício.
3. **A janela começa no fim do acesso gratuito já garantido**: `base = max(agora, fim do teste futuro, fim do benefício ativo anterior)`. Assim, dias sobrepostos não se perdem e dois benefícios não somam o mesmo intervalo. Os instantes são UTC com fim exclusivo. Um dia = 24 h, porque America/Sao_Paulo não tem horário de verão desde 2019. A interface mostra o último dia incluído (`lastIncludedDay`).
4. **Expirar é derivado da data.** Nenhum job encerra acesso; `ENCERRADO`/`AGENDADO`/`EM_VIGOR` são calculados na leitura.
5. **Prévia + confirmação com `revision` e `operationKey`.** A confirmação recalcula tudo dentro de uma transação com trava por tenant (`pg_advisory_xact_lock`) e recusa a prévia desatualizada (409). A mesma `operationKey` devolve a concessão já gravada, então um retry ou um clique duplo não soma dias.
6. **Conta com cobrança no Asaas** só com `GRATUIDADE_ASAAS=on` (feature flag, desligada por padrão). A prévia lê a assinatura e as cobranças no Asaas, fora de transação. O período pago (cada cobrança paga cobre um ciclo a partir do vencimento) entra na base. Cobrança em aberto com vencimento dentro da janela **bloqueia** com mensagem acionável; atraso anterior só é informado. Na confirmação, a concessão nasce `SYNCING`, a operação dedicada `setAsaasSubscriptionNextDueDate` (`PUT` com `updatePendingPayments: false`) adia a próxima cobrança para o dia em que o benefício termina (nunca antecipa) e só então vira `ACTIVE`. Em falha ou timeout, a reconciliação (agendador e abertura do usuário no admin) **lê o Asaas antes de repetir**; depois de 3 tentativas, `FAILED`, sem tirar acesso existente. `updateAsaasSubscription` (troca de plano) não muda. A operação fica nos campos da própria concessão (`previousDueDate`, `targetDueDate`, `syncAttempts`, `syncError`, `syncedAt`), sem tabela separada.
7. **Não elegíveis:** aluno, admin, conta sem espaço, sem assinatura (sem cadastro silencioso) e plano de preço zero (já é gratuito). Assinatura cancelada recebe acesso sem reativar cobrança.
8. **Auditoria** em `AdminBenefitAudit` (ator, alvo, operação, antes/depois, motivo), apagada junto com o espaço na exclusão de conta.

## Consequências

- Fatia 2: interface do administrador (Usuários → detalhe → Benefícios) e aviso "Acesso gratuito até …" em Assinatura.
- Fatia 3: conta com Asaas (acima). Validação no Sandbox pelo runbook `RUNBOOK-VERIFICACAO-GRATUIDADE-ASAAS-HOMOLOGACAO.md`, porque o ambiente de desenvolvimento não alcança o Asaas.
- Limitação: revogar uma gratuidade com cobrança no Asaas não antecipa a cobrança de volta (antecipar poderia gerar cobrança imediata). O histórico avisa para ajustar no Asaas se precisar.
- Cupons (feature 5): o intervalo gratuito não consome ciclo de cupom.
