# ADR-010 — Mecânica de assinatura SaaS agora, gateway de pagamento adiado; preço zero explícito

Status: **Aceito** (FIT-122, fora da numeração original do EPIC-12/EPIC-13)
Data: 27 de setembro de 2026

## Contexto

O EPIC-12 (Monetização) está pausado na `FIT-091` (prova técnica do Asaas) por bloqueio real de rede ao sandbox nesta sessão — sem alternativa até esse bloqueio ser resolvido externamente. Isso deixa toda a mecânica de assinatura (catálogo de planos, contratar, trocar, cancelar) presa atrás de uma dependência de infraestrutura que ninguém nesta sessão pode destravar, mesmo sendo trabalho que não depende, em si, de nenhum gateway real.

Decisão explícita de Murilo (Product Owner): "Vamos criar toda a mecânica deixando a integração para depois. Crie os planos com valor zerado nesse primeiro momento." Isso desacopla deliberadamente duas coisas que o pacote original tratava como uma sequência única (`FIT-090 → FIT-091 → FIT-092 → ...`): a **mecânica de negócio** (o que é um plano, o que é uma assinatura, como se contrata/troca/cancela) e a **cobrança real** (Asaas/Mercado Pago, tokenização, webhook, conciliação).

`FIT-105` (EPIC-13, "Assinar o FitOS Livre") já documentava depender exatamente deste motor ("reutiliza o motor da Fase 2.1/EPIC-12, produto B2C separado") — então a mecânica construída aqui precisa servir os dois públicos (`PERSONAL` e `INDIVIDUAL`) desde o início, não só o personal.

## Decisões

**1. Escopo desta História é mecânica, não o épico inteiro.** Implementa o equivalente a `FIT-090` (catálogo de planos configurável) e parte de `FIT-092`/`FIT-097` (contratar, trocar, cancelar uma assinatura) — nunca `FIT-091` (gateway real), `FIT-093`/`FIT-094`/`FIT-095` (meios de pagamento — sem sentido sem gateway), `FIT-096` (renovação automática — não existe cobrança para renovar), `FIT-098` (recuperação de pagamento) ou `FIT-099` (ledger/conciliação financeira real). Essa numeração (`FIT-122`) está fora da faixa reservada do pacote (`FIT-090`–`FIT-099`) de propósito — é trabalho novo, decidido fora da sequência original, não uma renumeração daquelas Histórias.

**2. `Plan.audience` reaproveita `TenantType` (`PERSONAL`/`INDIVIDUAL`) em vez de um enum próprio.** Os dois valores já existem e significam exatamente "quem pode assinar este plano" — um enum paralelo (`PlanAudience`) duplicaria o mesmo conceito sem ganhar nada, e uma condição só (`plan.audience === tenant.type`) já impede um `PERSONAL` assinar um plano do FitOS Livre e vice-versa.

**3. `SaasSubscription` (reservada desde a FIT-007, nunca usada por código de aplicação real) é estendida, não substituída.** `tenantId @unique` já garante fisicamente "no máximo uma assinatura por tenant" (provado por um teste de isolamento já existente) — a mesma linha é reaproveitada entre contratação inicial, troca de plano e reativação após cancelamento, nunca um histórico de linhas. Uma tabela de histórico completo (ledger) é exatamente o que `FIT-099` reservava para depois; construir isso agora seria escopo que ninguém pediu.

**4. "Versionamento de oferta" via `slug` novo + `active=false`, nunca edição do preço/limite de um plano já contratado.** Mesmo princípio já estabelecido para `TrainingPlan`/`PlanAssignment` (`ADR-005`): quem já assina um plano retirado continua com ele até trocar ou cancelar; um plano novo é sempre uma nova linha. Isso significa que mudar preços no futuro (quando o gateway existir) nunca é um `UPDATE` em `plans.priceCents` de uma linha já em uso — é criar `personal-essencial-v2` e desativar `personal-essencial`.

**5. `SaasSubscription.provider` grava um sentinela documentado (`NO_PAYMENT_PROVIDER = "sem_integracao"`), nunca um nome de gateway fictício.** O campo é `String` obrigatório desde a FIT-007 (antes de qualquer gateway existir) — inventar `"asaas"`/`"mercadopago"` antes da FIT-091 realmente integrar um desses seria uma mentira no dado; o sentinela é honesto sobre o estado real ("nenhuma integração de pagamento"), e o dia em que a FIT-091 acontecer, essa é a única string a trocar.

**6. Nenhuma imposição de `studentLimit`.** O campo existe no catálogo (informativo, exibido na UI) mas nenhuma rota de cadastro de aluno consulta ou bloqueia por ele. Impor um limite de verdade exigiria decidir o que acontece quando um personal já excede o limite do plano escolhido (bloquear novo cadastro? degradar? avisar?) — pergunta de produto que ninguém fez ainda; construir a resposta a uma pergunta não feita é exatamente o tipo de escopo especulativo que este projeto evita desde a FIT-020/023.

**7. Nenhuma assinatura automática de tenant novo.** Um `PERSONAL`/`INDIVIDUAL` recém-cadastrado não ganha nenhum `SaasSubscription` até visitar `/painel/assinatura` e escolher um plano — `getSubscriptionForTenant` retorna `null` normalmente para esse caso, tratado na UI como "nenhuma assinatura contratada ainda", nunca um erro.

**8. UI em rota própria (`/painel/assinatura`), não em `/painel/perfil`.** Esta branch parte de `main`, que ainda não tem o `/painel/perfil` com despacho por papel (isso existe apenas no branch não mergeado do redesign mobile-first, PR4/FIT-120 — `/painel/perfil` aqui continua exclusivo do papel `ALUNO`, FIT-016). Um destino novo e real (mesma solução já usada para "Alunos"/"Exercícios" nesta base: um item de navegação não espera a árvore conceitual do pai existir) evita tanto mexer numa página que não é dona desta História quanto um conflito de merge desnecessário quando o redesign eventualmente for mergeado.

## Alternativas consideradas

1. **Esperar a FIT-091 (gateway) ser desbloqueada antes de escrever qualquer mecânica.** Rejeitada explicitamente por Murilo — o bloqueio é de rede/sandbox, não de decisão de produto; a mecânica de planos/assinatura não depende de nenhum gateway para existir e ser útil (cadastro de planos, seleção, troca, cancelamento são reais mesmo com preço zero).
2. **Um enum `PlanAudience` próprio, paralelo a `TenantType`.** Rejeitada — duas fontes de verdade para o mesmo conceito, sem nenhum caso de uso que uma delas não cubra.
3. **Reaproveitar `/painel/perfil` e implementar o despacho por papel aqui, adiantando o que o redesign (não mergeado) já fez.** Rejeitada — antecipar uma decisão de UI de um branch de outra Epic (redesign, FIT-120) que ainda não foi aprovado gera acoplamento e risco de conflito maior do que um destino novo e isolado.

## Consequências

- Quando a FIT-091 (ou equivalente) finalmente integrar um gateway real, o trabalho é: (a) trocar `NO_PAYMENT_PROVIDER` por uma chamada real ao provedor dentro de `subscribeTenantToPlan`/`cancelSubscription`; (b) decidir preços reais (nova versão de cada plano, nunca editar o existente); (c) implementar webhook/conciliação. Nenhuma mudança de schema adicional é esperada para isso além de campos específicos do provedor (ex.: `externalSubscriptionId`).
- `FIT-105` (assinar o FitOS Livre) deixa de estar bloqueada **no nível do motor** — a mecânica que ela pedia já existe e já aceita `INDIVIDUAL`. A História em si (uma tela dedicada dentro da jornada do FitOS Livre, se diferente de `/painel/assinatura`) continua não implementada — decisão de produto para quando for priorizada.
- `studentLimit` continua sem nenhuma imposição real — um personal pode ter mais alunos ativos do que seu plano "permite" sem nenhum bloqueio, hoje. Sinalizado aqui para não ser confundido com um bug quando a imposição for eventualmente pedida.
