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
6. **Conta com cobrança no Asaas (assinatura externa ou cartão) não é elegível nesta fatia.** Sem ajustar `nextDueDate` e conferir cobranças já emitidas, prometer gratuidade seria falso. A operação dedicada (`applyAdministrativeGrantBilling`, estados `SYNCING`/`FAILED`, reconciliação) é a fatia 3, validada no Railway, porque a rede deste ambiente não alcança o sandbox. `updateAsaasSubscription` não muda.
7. **Não elegíveis:** aluno, admin, conta sem espaço, sem assinatura (sem cadastro silencioso) e plano de preço zero (já é gratuito). Assinatura cancelada recebe acesso sem reativar cobrança.
8. **Auditoria** em `AdminBenefitAudit` (ator, alvo, operação, antes/depois, motivo), apagada junto com o espaço na exclusão de conta.

## Consequências

- Fatia 2: interface do administrador (Usuários → detalhe → Benefícios) e aviso "Acesso gratuito até …" em Assinatura.
- Fatia 3: conta com Asaas, `nextDueDate`, cobranças emitidas na janela (bloqueio com mensagem acionável), reconciliação.
- Cupons (feature 5): o intervalo gratuito não consome ciclo de cupom.
