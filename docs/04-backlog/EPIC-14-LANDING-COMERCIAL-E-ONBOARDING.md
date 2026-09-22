# EPIC-14 — Landing comercial, onboarding completo e biblioteca ilustrada de exercícios

## Origem

Pacote enviado por Murilo diretamente nesta sessão (`FitOS_Pacote_Claude_Parte_1_de_3.zip`, `..._Parte_2_de_3_OTIMIZADA.zip`, `..._Parte_3_de_3.zip`) — instrução única (`PROMPT_CLAUDE_LANDING_ONBOARDING_FITOS.md`) + 56 assets (45 ilustrações de exercícios + 11 fotos/mockups de marketing), distribuídos em três arquivos por causa do tamanho, sem relação estrutural com o pacote pós-MVP das EPIC-12/13 (mesmo assim, depende do que já foi entregue por elas — ver "Dependências" abaixo).

Diferente dos pacotes anteriores desta sessão (que traziam um backlog numerado em seções `NN_ARQUIVO.md`), este pacote é uma única instrução direta de implementação, no formato "prompt para o Claude", com regras de execução, critérios de aceite e um relatório de entrega esperado. A quebra em Histórias `FIT-110`+ abaixo é uma decomposição feita por Engenharia para caber no processo de branch/PR/gate já em uso nesta base — não vem numerada no pacote original.

## Objetivo

Substituir a landing page placeholder (`src/app/page.tsx`, herdada da FIT-006/fundação técnica) por uma landing comercial real, reformular a entrada do onboarding para apresentar os três caminhos do produto com a mesma clareza (Personal / Aluno vinculado por convite / FitOS Livre independente), e entregar uma biblioteca ilustrada de exercícios com busca e filtros — sem regredir nenhum fluxo já funcional (convite/ativação da FIT-015, onboarding individual da FIT-101, autenticação).

## Levantamento prévio (seção 12 do pacote — feito antes de qualquer código)

- `src/app/page.tsx` é só a fundação técnica da FIT-006 (nenhum guard de auth, nenhum redirect) — pode ser substituída inteiramente sem tocar em lógica de sessão.
- `/criar-conta?modo=individual` (FIT-101) e o convite/ativação de aluno (FIT-015) já resolvem boa parte dos contratos de backend pedidos pelo pacote — a decisão de papel por `?modo=` já existe (`ADR-007-SELECAO-DE-PAPEL-NO-CADASTRO.md`).
- O Design System M3 já tem a paleta lima/navy e o tema escuro que o pacote pede como direção visual (`docs/03-design/M3-DESIGN-TOKENS.md`) — nenhum Design System paralelo é necessário.
- `Exercise` (schema Prisma) **não tem campo de imagem hoje** — a biblioteca ilustrada exige migration nova.
- Não existe nenhum catálogo de produtos/planos do FitOS Livre em código — EPIC-12 (Monetização) está pausado na `FIT-091` e nunca chegou a implementar isso; a `FIT-105` (que reutilizaria esse motor) também nunca foi implementada. O pacote exige que o catálogo do FitOS Livre "venha do backend, nunca hardcoded" — implica um model/módulo novo, mínimo e real (nunca simular cobrança, conforme a própria regra do pacote).
- Referência visual navegável do pacote (`https://fitos-em-movimento.hmqsgqtv8q.chatgpt.site`) está fora do alcance de rede desta sandbox (proxy de saída bloqueia o domínio) — direção visual seguida pela seção 4 do pacote (texto) + tokens M3 já existentes, documentado como limitação real, nunca como suposição silenciosa.

## Regras obrigatórias do pacote (resumo — texto completo em `PROMPT_CLAUDE_LANDING_ONBOARDING_FITOS.md`, preservado fora do controle de versão por conter apenas instrução, sem dado sensível)

- Branch própria a partir da `main` atualizada; nunca commit ou merge direto na `main`.
- Reutilizar componentes/tokens/padrões existentes; nunca um segundo Design System.
- Não inventar endpoint se já existir equivalente; inspecionar a implementação atual antes de tocar em modelo/rota/autenticação.
- Nenhum dado sensível, senha, token ou segredo em frontend, fixtures, logs ou documentação.
- `tenantId` sempre derivado no servidor, nunca aceito do cliente.
- Imagens: locais, otimizadas (WebP/AVIF), com dimensão definida (sem layout shift) e `loading="lazy"` fora da primeira dobra; nunca hotlink da referência; nunca placeholder da internet.
- Biblioteca de exercícios: manifesto de importação idempotente (dry-run, checksum, relatório de importados/atualizados/ignorados/falhos), nunca o nome do arquivo como única fonte de verdade, nunca executada automaticamente em deploy.
- Catálogo de produtos do FitOS Livre: vem do backend; nunca simular cobrança; nenhum link de loja de app falso (estado "Em breve" documentado se a URL real não existir).
- Critérios de aceite completos, testes (unitário/integração/E2E), evidências visuais reais (não Figma) e documentação — tudo descrito na íntegra em `PROMPT_CLAUDE_LANDING_ONBOARDING_FITOS.md`, seções 9–17.

## Adaptação de processo registrada (seção 12 do próprio pacote autoriza: "preserve a arquitetura e registre a adaptação")

O pacote pede "uma única PR contendo documentação e código". A governança desta base (em uso desde a FIT-006) já exige branch por História, PR com gate `PRONTO PARA REVISÃO GPT/CODEX — NÃO MERGEAR`, e revisão antes de qualquer merge — um monólito de PR única dificultaria exatamente essa revisão externa que a própria governança exige. Decisão de Engenharia: preservar o processo já em uso (uma PR por História, todas as Histórias desta EPIC entregues em sequência, cada uma com seu próprio código+testes+documentação), e registrar aqui essa adaptação. O resultado final — landing, onboarding completo e biblioteca — é o mesmo; a diferença é só o empacotamento em revisão.

## Dependências

- Depende do que a FIT-015 (convite/ativação) e a FIT-101 (onboarding individual) já entregam — reaproveitadas, não recriadas.
- Não depende do EPIC-12 (Monetização) estar concluído: o catálogo de produtos do FitOS Livre pedido aqui é deliberadamente mínimo (nome, descrição, preço de exibição, periodicidade, benefícios, ativo/inativo) — o motor real de cobrança (Asaas) continua sendo escopo exclusivo da FIT-090/091/105, pausadas.

## Histórias

| História | Resumo |
|---|---|
| FIT-110 | Landing page comercial (cabeçalho, hero, benefícios, seção Personal/Aluno, CTA final, rodapé) |
| FIT-111 | Biblioteca ilustrada de exercícios (migration de imagem, manifesto/importação idempotente, busca e filtros, detalhe) |
| FIT-112 | Entrada do onboarding com os três caminhos explícitos (Personal / Aluno com convite / FitOS Livre) |
| FIT-113 | Onboarding do Personal — etapas completas (dados da conta, perfil profissional, revisão) |
| FIT-114 | Onboarding do Aluno vinculado — objetivo principal e revisão sobre o convite já existente (FIT-015) |
| FIT-115 | Catálogo de produtos e onboarding do FitOS Livre (model novo, escolha de produto, CTA de app) |
| FIT-116 | Testes E2E consolidados, evidências visuais e documentação final dos critérios de aceite |

## Critérios de aceite

Os 21 itens da seção 17 do pacote (`PROMPT_CLAUDE_LANDING_ONBOARDING_FITOS.md`) — não duplicados aqui para nunca divergir da fonte; cada História abaixo referencia os itens que resolve.

## Estado

Em andamento — ver `docs/06-engenharia/DIARIO-DE-EXECUCAO-MVP.md` para o progresso história por história.
