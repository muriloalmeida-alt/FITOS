# Relatório final — EPIC-16 (Marca real, jornada de entrada e monetização com Asaas)

Data: 28/09/2026. Autor: sessão Claude Code (branch por História, PRs individuais, revisão automatizada + gates de CI antes de cada merge). Issue-mãe: [EPIC-16 #148](https://github.com/muriloalmeida-alt/FITOS/issues/148).

**Este relatório não declara o épico integralmente concluído.** Duas pendências reais impedem isso — ver seção "Pendências reais" antes de qualquer leitura das seções de sucesso abaixo.

## Resumo por História

| História | Branch | PR | Commit de merge | Estado |
|---|---|---|---|---|
| FIT-124 — Identidade visual | `feature/fit-124-identidade-visual` | [#156](https://github.com/muriloalmeida-alt/FITOS/pull/156) | `044ecf4` | Concluída |
| FIT-125 — Rotas e sessão | `feature/fit-125-rotas-sessao` | [#157](https://github.com/muriloalmeida-alt/FITOS/pull/157) | `cc1d88c` | Concluída |
| FIT-127 — Planos e preços reais | `feature/fit-127-planos-precos-reais` | [#158](https://github.com/muriloalmeida-alt/FITOS/pull/158) | `848bb46` | Concluída |
| FIT-126 — Onboarding guiado | `feature/fit-126-onboarding-guiado` | [#159](https://github.com/muriloalmeida-alt/FITOS/pull/159) | `0ffc00c` | Concluída |
| FIT-128 — Integração real com Asaas | `feature/fit-128-investigacao-rede` | [#160](https://github.com/muriloalmeida-alt/FITOS/pull/160) | `ccf263e` | **Pausada por bloqueio real de rede** — nenhuma linha de integração escrita |
| FIT-129 — Revisão visual integral | `feature/fit-129-revisao-visual-integral` | (este PR) | — | Concluída **dentro do que este sandbox permite** — ver pendências |

## O que foi entregue

- **Marca real** (FIT-124): paleta azul-noturno (`#101C2C`) + laranja (`#FF7847`) sobre fundo claro, aplicada via `tokens.css` a toda a aplicação — nunca uma segunda marca paralela. Vetores oficiais (`public/marca/*.svg`) usados sem redesenho. Favicon/manifest/ícones PWA novos.
- **Rotas e sessão** (FIT-125): `/` resolve sessão no servidor (nunca renderiza HTML visível); `/entrar` com hero fotográfico full-bleed; `/conheca` landing pública indexável; `/comecar` com os três cartões de escolha e URL navegável; redirect 308 de compatibilidade para as rotas antigas.
- **Planos e preços reais** (FIT-127): Personal 20/50/Ilimitado (R$49,90/69,90/99,90) e FitOS Livre (R$19,90), todos com 30 dias de trial concedido uma única vez por tenant (nunca reiniciado ao trocar de plano). Geração anterior (preço zero) desativada, nunca removida — assinantes existentes não são afetados. `studentLimit` agora imposto de verdade. Versionamento por slug novo documentado em ADR-013 (corrige uma citação equivocada de "ADR-005" nos documentos originais do épico).
- **Onboarding guiado** (FIT-126): seleção de plano real (com trial) incorporada ao onboarding do Personal (nova sub-etapa) e do FitOS Livre (que passou de formulário único a wizard de 2 etapas). Wizard genérico extraído (`WizardProgress`, `useUnsavedChangesGuard`, `PlanOptionCard`, em `src/shared/ui`) e reaproveitado pelos dois. O onboarding do Aluno convidado foi revisado e **já atendia** os critérios do pacote (recuperação clara de convite inválido/expirado/reutilizado, nunca cobra o aluno pelo vínculo) — confirmado nesta sessão, sem mudança de código.
- **Revisão visual integral** (FIT-129, esta História): percorridas as três jornadas de entrada ponta a ponta com contas reais criadas pela própria interface (nunca inseridas direto no banco, exceto o convite do aluno, gerado pela função de domínio real). Evidência visual em `docs/06-engenharia/evidencias/FIT-129/` — ver README ali para a lista completa e dois achados registrados (um falso positivo de método de captura, um dado de ambiente desatualizado corrigido sem tocar em código).

## Testes executados (acumulado das Histórias desta sessão)

Cada PR (#156–#160) rodou a suíte completa antes do merge, sempre verde (`tsc --noEmit`/`eslint .`/`npm run build`/`npm audit --omit=dev` limpos em todos). A suíte cresceu de ~904 para **1053 testes** ao longo do épico (FIT-124 a FIT-126). O detalhe teste a teste de cada História está no diário de execução (`DIARIO-DE-EXECUCAO-MVP.md`) e no corpo de cada PR.

Nesta sessão (FIT-129) não foi necessária nenhuma mudança de código de produção — apenas documentação e evidência —, então nenhum teste novo foi adicionado; a suíte existente (1053/1053) continua sendo a garantia de regressão.

## Evidências

- `docs/06-engenharia/evidencias/FIT-129/README.md` — evidência consolidada das três jornadas (Personal, FitOS Livre, Aluno), capturada **em ambiente de desenvolvimento local deste sandbox** (`npm run dev`, banco `fitos_dev`), largura completa (360/768/1024/1440px) para as telas exigidas pela Issue #154.
- Evidências das Histórias FIT-124/125/126/127 foram capturadas em suas respectivas sessões via Playwright e mostradas diretamente a Murilo no chat — **nunca commitadas ao repositório** (gap identificado nesta revisão, não corrigido retroativamente porque recriar contas/estado exatamente daquelas capturas seria reconstrução, não evidência real da época). A FIT-129 cobre a mesma jornada de ponta a ponta de novo, com a marca e o catálogo já consolidados, e essa é a evidência commitada que deve ser tratada como autoritativa daqui em diante.

## Resultado exato da prova técnica do Asaas

**Não executada.** Antes de escrever qualquer código de integração (FIT-128), a conectividade de rede deste ambiente foi testada e confirmada bloqueada:

```
curl https://api-sandbox.asaas.com/v3/customers → CONNECT tunnel failed, 403 (connect_rejected)
curl https://api.asaas.com/v3/customers        → CONNECT tunnel failed, 403 (connect_rejected)
curl https://api.mercadopago.com                → CONNECT tunnel failed, 403 (connect_rejected)
```

O proxy de saída deste ambiente opera por lista de permissão — qualquer domínio de terceiro fora dela é recusado pela política da organização, **tanto para o Asaas (candidato primário) quanto para o Mercado Pago (fallback documentado)**. Não é instabilidade, nem específico de um provedor. Documentado em detalhe no PR #160 e no comentário da Issue #153. Nenhuma linha de código de integração com pagamento foi escrita.

Murilo foi consultado sobre como proceder (mecânica sem chamada real / aguardar acesso de rede / executar a prova fora deste sandbox) e optou por seguir para a FIT-129 agora, mantendo a FIT-128 pausada.

## Pendências reais (nunca escondidas)

1. **FIT-128 não foi implementada.** Bloqueio de rede real, fora do alcance de qualquer mudança de código nesta sessão. Sem ela, não existe cobrança real, meios de pagamento, webhook, renovação automática, inadimplência ou conciliação financeira — tudo isso continua exatamente como o ADR-010 já deixava explícito.
2. **Nenhuma validação em homologação real (Railway) foi executada.** Esta sessão não tem credenciais do Railway CLI (`railway whoami` retorna `Unauthorized`) nem qualquer outro acesso à infraestrutura de homologação (`fitos-web-hml`/`fitos-postgres-hml`, mencionados nos comentários automáticos do bot de deploy nos PRs). Toda evidência desta revisão é de ambiente de desenvolvimento local deste sandbox — nunca apresentada como homologação real. Validar as três jornadas, as quatro ofertas, o trial, os limites de alunos e as rotas **em homologação de fato** continua pendente.
3. **Contas Personal/Individual já existentes antes da FIT-126 nunca são levadas de volta ao onboarding para escolher um plano.** O gate de `/painel` verifica só a existência do perfil, não da assinatura — decisão documentada em `ONBOARDING-PERSONAL.md`, consequência direta de nunca cobrar um usuário gratuito existente sem uma nova escolha explícita (regra do próprio documento de decisão). Uma migração de contas existentes, se necessária, é uma decisão de produto própria, ainda não tomada.
4. **"Plano do profissional como contexto" na tela de ativação do aluno** — item que o próprio pacote marca como "só contexto" (não obrigatório) — não foi implementado; o critério real de aceite (nunca cobrar o aluno) já está garantido sem essa exibição.
5. **43 de 208 exercícios do catálogo têm imagem** — pendência pré-existente da FIT-111, confirmada ainda presente nesta revisão (placeholder "Sem imagem" visível na evidência da FIT-129), não uma regressão desta sessão.

## Conclusão

FIT-124, FIT-125, FIT-126 e FIT-127 estão de fato concluídas, mescladas em `main`, com gates verdes e evidência real. FIT-129, dentro do que este sandbox permite (sem acesso a homologação real), também está concluída. **FIT-128 permanece pausada por um bloqueio de infraestrutura real e documentado, não por falta de trabalho** — e por isso o EPIC-16 como um todo **não pode ser declarado encerrado** até essa peça (ou uma decisão explícita de Murilo sobre como tratá-la) existir.
