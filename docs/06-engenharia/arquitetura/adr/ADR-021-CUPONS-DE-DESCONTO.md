# ADR-021: Cupons de desconto, campanha finita e aplicação por cobrança

Status: **Aceito** (feature 5, Cupons de desconto)
Data: 11 de outubro de 2026

## Contexto

O administrador precisa criar cupons de valor fixo ou percentual para a assinatura SaaS do FitOS (PERSONAL e INDIVIDUAL), com público definido (novos, ativos, inativos ou contas selecionadas). O cupom nunca desconta a mensalidade que o personal cobra dos próprios alunos (`StudentCharge`).

O PDF "5-Cupons-Desconto" (v1.0) faz duas exigências:
- não dar **desconto eterno**, ou seja, não reduzir o valor da assinatura no Asaas e depender de um job para restaurar;
- não prometer um preço final que o provedor não aplicou.

Hoje o FitOS não guarda as cobranças SaaS. O webhook (`asaasWebhook.ts`) só muda `SaasSubscription.status`, então não há como saber se uma conta "já pagou" (segmento Novos) nem quais ciclos o cupom cobriu.

## Regras aprovadas pelo produto (11/10/2026)

1. **Sem acumulação por padrão.** Uma campanha marcada como **acumulável** combina com no máximo **1** outro cupom também acumulável. Cupom não acumulável fica sempre sozinho.
2. **Ordem de aplicação quando há dois:**
   - primeiro o **valor fixo**, depois o **percentual** sobre o que sobrou;
   - nunca abaixo de R$ 0;
   - o desconto é arredondado uma única vez por cupom (half-up, em centavos).
3. **Nunca junto com a gratuidade administrativa.** O período coberto por `AdministrativeAccessGrant` (ou pelo teste) não tem cobrança, então não consome ciclo de cupom; o cupom começa na primeira cobrança paga depois dele.
4. **Duração em ciclos pagos** (1, 2, 3, 6 ou 12). Não existe cupom perpétuo. As condições ficam **congeladas no resgate**: valor, tipo, ciclos e plano.
   - Expirar o prazo de resgate ou pausar a campanha não desfaz um resgate já feito.
   - Editar uma campanha que já tem resgate cria uma nova versão.

## Decisões

1. **Modelo:**
   - `Coupon` guarda o código normalizado (A–Z, 0–9 e hífen, de 3 a 32 caracteres, único), o status (`DRAFT`, `ACTIVE`, `PAUSED`, `ENDED`, `ARCHIVED`) e a versão vigente.
   - `CouponVersion` guarda as regras imutáveis:
     - tipo `PERCENT` (em basis points) ou `FIXED_AMOUNT` (em centavos);
     - produto (PERSONAL, INDIVIDUAL ou ambos) e segmentos (NOVOS, ATIVOS e INATIVOS, combinados com OU; ou SELECIONADOS);
     - planos e ciclos elegíveis, janela de resgate em America/Sao_Paulo com fim exclusivo, duração em ciclos, limite total, limite por conta, orçamento em centavos e se é acumulável.
   - `CouponAudienceMember` lista as contas selecionadas.
   - `CouponRedemption` é o resgate por tenant, com um snapshot das regras e do segmento, `cyclesGranted`, `cyclesUsed` e estado (`RESERVED`, `COMMITTED`, `ENDED`, `CANCELED`).
   - `CouponCycleApplication` registra uma linha por cobrança descontada, única por resgate e cobrança.
   - `SaasPayment` é o ledger das cobranças SaaS vindas do webhook (`paymentId` único, valor, vencimento, estado e `paidAt`).
2. **Segmentos avaliados no servidor, no instante do resgate:**
   - **Novos:** nenhuma `SaasPayment` paga. Conta em teste é nova.
   - **Ativos:** assinatura `ATIVA` com pelo menos uma cobrança paga.
   - **Inativos:** assinatura `CANCELADA` sem período pago vigente.
   - **Inadimplente** não é inativo; por padrão não é elegível.
   - **Selecionados:** estar na lista é obrigatório e se soma (com E) às demais regras.
   - **Aluno de personal** nunca é elegível.
3. **Capacidade e orçamento atômicos.** O resgate trava a versão do cupom (`SELECT … FOR UPDATE`) e conta os resgates `COMMITTED` mais os `RESERVED` ainda válidos (TTL de 15 minutos). A mesma `operationKey` devolve o mesmo resgate. O orçamento compromete o desconto máximo (ciclos × desconto no preço atual) e libera o que sobrar quando o resgate termina.
4. **Aplicação por cobrança, não por assinatura.**
   - O valor recorrente da assinatura no Asaas **nunca muda** por causa de cupom.
   - Quando chega uma cobrança da assinatura (webhook `PAYMENT_CREATED`) e há resgate com ciclos restantes, o FitOS atualiza **aquela cobrança** (`PUT /v3/payments/{id}` com `value`) e grava `CouponCycleApplication` (`PENDING` → `APPLIED`).
   - O ciclo só é contado quando a cobrança é paga (`PAYMENT_CONFIRMED` ou `RECEIVED`, uma vez por `paymentId`).
   - Acabados os ciclos, as próximas cobranças simplesmente vêm cheias. Não há o que restaurar, então não existe desconto eterno.
   - Falha ou timeout deixa `PENDING`. A reconciliação **lê a cobrança no Asaas antes de repetir**.
   - Cobrança já paga, ou cartão já capturado, não é alterada: o ciclo fica sem desconto e o resgate não o consome.
5. **Desconto de 100%** (final R$ 0) não é enviado como cobrança zero. Nesta versão, o admin não consegue criar cupom com final zero para nenhum plano elegível (validado na prévia). Ciclo não monetário fica para depois.
6. **Flags:**
   - `FEATURE_CUPONS` liga a administração e o resgate;
   - `CUPONS_ASAAS` liga a escrita no Asaas (item 4) e só deve ser ligada depois do runbook no Sandbox, porque este ambiente não alcança o provedor;
   - sem `CUPONS_ASAAS`, o resgate pode ser feito, mas a tela diz que o desconto "será aplicado nas próximas cobranças" e nada é prometido como já aplicado.
7. **Fatias:**
   - (1) ADR, modelo, motor puro de preço e elegibilidade, ledger `SaasPayment` e administração (criar, prévia, ativar, pausar e listar);
   - (2) resgate pelo cliente em Assinatura;
   - (3) aplicação no Asaas, reconciliação e runbook.

## Consequências

- O webhook passa a guardar as cobranças (`SaasPayment`). Isso também serve à gratuidade (ADR-017) e a relatórios.
- **Troca de plano:**
  - o resgate continua se o novo plano for elegível;
  - se não for, o resgate termina, e a tela avisa antes;
  - os ciclos usados não reiniciam.
- **Cancelamento:** encerra o resgate. Reembolso não devolve o uso.

## Adendo — fatia 2: resgate pela conta

- **Consulta e confirmação:**
  - a consulta (`POST /api/meus-cupons/previa`) não consome nada; devolve o preço e uma `revision`;
  - a confirmação (`POST /api/meus-cupons`) refaz tudo numa transação e recusa a prévia desatualizada (`QUOTE_STALE`);
  - a mesma `operationKey` devolve o mesmo resgate.
- **Trava:** a transação trava a conta (`pg_advisory_xact_lock`, para a acumulação) e a versão do cupom (`SELECT … FOR UPDATE`, para a última vaga e o orçamento).
- **Sem estado `RESERVED` nesta versão:** o resgate não chama o provedor, então não há operação externa em voo para esperar e ele grava direto como `COMMITTED`. A reserva com TTL volta se um checkout com confirmação externa passar a usar cupom.
- **Erros do contrato:** `INVALID_CODE` (também para rascunho e arquivado, sem revelar que existem), `EXPIRED` (pausado, encerrado ou fora da janela), `INELIGIBLE` (sem plano, plano fora ou público errado, sem revelar a lista), `ALREADY_USED`, `CAP_REACHED` (vagas ou orçamento), `CONFLICT` (acumulação, ou cobrança que ficaria zerada) e `QUOTE_STALE`.
- **Condições congeladas no resgate:** tipo, valor, ciclos, plano, segmento e desconto por ciclo no preço do dia. O orçamento comprometido é ciclos × desconto.
- **Tela:** "Tem um cupom?" em Assinatura (personal e Livre, nunca assinatura inadimplente) e a lista dos cupons com "x de N cobranças com desconto". A tela não promete que uma cobrança já mudou: o desconto entra nas próximas cobranças ainda não emitidas (fatia 3).
