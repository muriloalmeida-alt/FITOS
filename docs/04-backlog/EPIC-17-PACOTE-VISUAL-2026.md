# EPIC-17 — Pacote visual 2026 (reformulação visual completa)

## Origem

Murilo enviou `FitOS_Pacote_Visual_Aprovado_Claude_2026-09-28.zip` em 28/09/2026, com a instrução explícita: executar 100% do escopo autonomamente, sem margem para discussão. O pacote é a especificação visual final e vinculante para 11 telas de referência (mobile 390×844 e desktop 1440×900) mais todas as telas/estados secundários — recuperação de senha, convite/ativação, CRUD de treino, execução, avaliações, evolução, perfil, assinatura, estados de carregamento/erro/vazio/confirmação/permissão.

Issue GitHub: [EPIC-17 #169](https://github.com/muriloalmeida-alt/FitOS/issues/169).

Diferente do `EPIC-16` (marca/onboarding/monetização, já concluído), este pacote é uma segunda rodada — mais rigorosa e completa — de reformulação visual, com precedência de decisão em 5 níveis definida no próprio pacote (regras de negócio reais > contrato do pacote > prints mobile v5 > `04-DESKTOP-FINAL-SEM-AMBIGUIDADES.md`/prints desktop > tokens M3 evoluídos por ADR).

## Conteúdo do pacote

- `especificacoes/01-CONTRATO-VISUAL-E-ROTAS.md` — mapa de 11 telas → rotas reais, regras por papel, regras de dados/privacidade.
- `especificacoes/02-IMAGENS-LOGO-ICONES-E-MOVIMENTO.md` — fotos de marca, decisão logo-sobre-foto, geometria de ícones/barra, tokens de movimento.
- `especificacoes/03-PLANO-DE-IMPLEMENTACAO-E-ACEITE.md` — sequência de 5 PRs e critérios de aceite verificáveis.
- `especificacoes/04-DESKTOP-FINAL-SEM-AMBIGUIDADES.md` — geometria desktop mestre, tabela página a página.
- `assets/` — ícones de navegação (SVG), variante da marca sem retângulo de fundo, 6 fotos novas.

## Sequência de execução (5 PRs, nenhum mesclado direto em `main`)

1. **PR1 — Fundação visual e navegação** ([FIT-131 #170](https://github.com/muriloalmeida-alt/FitOS/issues/170)): marca sobre foto, ícones, tokens editoriais, geometria do `AppShell`. Sem alteração de regra de negócio.
2. **PR2 — Entrada e onboarding**: `/entrar`, `/conheca`, `/comecar`, `/onboarding-personal`, `/onboarding`, seleção de plano.
3. **PR3 — Personal**: `/painel`, `/painel/alunos`, `/painel/treinos`, `/painel/exercicios`, `/painel/financeiro`, `/painel/assinatura`.
4. **PR4 — Aluno e Livre**: dashboards, execução de treino, evolução, perfil/assinatura.
5. **PR5 — Consolidação**: estados vazio/erro/carregamento, acessibilidade, validação nas 4 larguras (360/390/768/1024/1440px), documentação final, validação em Railway homologação com contas reais dos três papéis.

## Restrições obrigatórias (todo o épico)

- Nunca dado, foto ou pagamento simulado; nunca destino de UI sem rota real, autorizada e implementada.
- Preservar autenticação, tenancy, contratos de backend, convite de aluno, mecânica de trial/plano atual e a separação `StudentCharge` (cobrança manual do aluno) vs. `SaasSubscription` (assinatura SaaS do tenant) — nunca confundidas em nenhuma tela.
- Tela 11 do pacote (financeiro/assinatura) implementada como **duas rotas reais distintas**, nunca uma tela mesclada/comparativa.
- Variante transparente da marca só sobre fotografia com gradiente contínuo na própria imagem — nunca um retângulo flat atrás do logo.
- Solução de overflow de navegação ("Mais") documentada explicitamente por papel (Personal e FitOS Livre) em cada PR que a toque.
- Nunca declarar "aplicado a toda a aplicação" com qualquer área ainda não revisada — cada PR lista as lacunas restantes.

## Aceite do épico

Só conclui com: (1) os 5 PRs revisados e mesclados; (2) validação visual real em Railway homologação, nas 4 larguras exigidas, com contas reais dos três papéis (Personal, Aluno, FitOS Livre); (3) aceite explícito de Murilo — nunca apenas por testes automatizados ou diff de código passarem.

## Sub-issues

- [FIT-131 #170](https://github.com/muriloalmeida-alt/FitOS/issues/170) — PR1: Fundação visual e navegação. Mesclado (PR #171).
- [FIT-132 #172](https://github.com/muriloalmeida-alt/FitOS/issues/172) — PR2: Entrada e onboarding. Mesclado (PR #173).
- [FIT-133 #174](https://github.com/muriloalmeida-alt/FitOS/issues/174) — PR3: Personal. Mesclado (PR #175).
- [FIT-134 #176](https://github.com/muriloalmeida-alt/FitOS/issues/176) — PR4: Aluno e Livre. Mesclado (PR #177).
- [FIT-135 #178](https://github.com/muriloalmeida-alt/FitOS/issues/178) — PR5: Consolidação (acessibilidade, 4 larguras, documentação final). Mesclado (PR #179).
- [FIT-136 #180](https://github.com/muriloalmeida-alt/FitOS/issues/180) — Correção pós-validação real: `/painel/exercicios` não seguia `tela-08`. Mesclado (PR #181).
- [FIT-137 #182](https://github.com/muriloalmeida-alt/FitOS/issues/182) — Correção grande pós-validação real: telas 06 (Dashboard Personal), 07 (Alunos), 09 (Aluno) e 10 (FitOS Livre) não seguiam o pacote — encontradas numa comparação sistemática de todas as 11 telas, pedida explicitamente por Murilo ("revise todas as telas"). Mesclado (PR #183).

## Status do aceite do épico (ver "Aceite do épico" acima)

- (1) 5 PRs do plano revisados e mesclados: **concluído**. Duas correções pós-validação adicionais, ambas mescladas: FIT-136 (PR #181) e FIT-137 (PR #183) — nenhuma delas conta como o épico "pronto" enquanto a validação visual abaixo não estiver completa.
- (2) Validação visual real em Railway homologação, nas 4 larguras, com contas reais dos três papéis: **em andamento**. Murilo já iniciou com a conta Personal real em `hml-fitos.up.railway.app`. Uma revisão sistemática de código contra as 11 telas de referência (pedida por ele) encontrou lacunas reais em 4 telas (06/07/09/10 — as duas últimas nunca tinham sido verificadas contra o print, e a tela 10 tinha o maior gap do épico: o estado padrão do FitOS Livre não tinha hero, evolução nem plano). Corrigidas e mescladas no FIT-137 (PR #183). Faltam: reconfirmar Personal após esta correção, e validar Aluno e FitOS Livre pela primeira vez. Este programa de execução não tem meios de repetir essa validação sozinho (sandbox sem PostgreSQL/Docker e sem acesso de rede a `railway.app`).
- (3) Aceite explícito de Murilo: pendente do item (2) acima — não pode ser antecipado por testes automatizados ou diff de código, conforme a própria regra do épico. **Lição registrada, reforçada duas vezes**: uma avaliação minha de que as capturas "pareciam boas" foi precipitada e corrigida por Murilo (FIT-136); a correção seguinte (FIT-137) mostrou que o problema era maior do que a primeira correção sozinha resolvia. Daqui em diante, qualquer tela é comparada explicitamente contra o print mapeado em `01-CONTRATO-VISUAL-E-ROTAS.md` antes de qualquer conclusão — nunca "parece certo", nunca "já corrigi uma tela, deve estar tudo bem agora".
