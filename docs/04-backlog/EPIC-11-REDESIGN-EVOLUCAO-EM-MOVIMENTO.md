# EPIC-11 — Redesign "Evolução em movimento"

## Origem

Pacote `FitOS_Pacote_Implementacao_Redesign_MVP_v1` (versão 1.0, status "aprovado por Produto"), entregue por Murilo Almeida em 21/09/2026, após feedback direto sobre o MVP mergeado no PR #73 ("visualmente está horrível sem nenhum dos elementos visuais e cores que previmos"). Primeiro passo já mergeado antes deste Epic ser formalizado: PR #75/Issue #74 (chrome navy no `AppShell`), tratado como o início do Lote A.

Os 6 documentos do pacote (`PROMPT_IMPLEMENTACAO_CLAUDE.md`, `docs/01` a `docs/06`) e os 13 ativos de mídia (`assets/brand/`, `assets/exercises/`) foram lidos/verificados integralmente (hashes SHA256 do manifesto confirmados) antes de qualquer código deste Epic.

## Conceito

**Evolução em movimento.** Interface ativa, humana e precisa — nunca um painel administrativo genérico. Fotografia real (aprovada por Produto) em cenário dark navy/grafite com luz teal e lime como recorte. Energia esportiva madura, sem agressividade. Superfícies claras para gestão, superfícies escuras para foco/execução.

## Autoridades (conforme `PROMPT_IMPLEMENTACAO_CLAUDE.md`)

1. Documentação atual do repositório define comportamento funcional.
2. O pacote de redesign define direção visual, hierarquia, experiência e mídia.
3. O protótipo de referência define intenção visual e navegação, não cria requisitos funcionais.
4. Em conflito funcional, prevalece o repositório; toda divergência é registrada no PR correspondente.

## Restrições obrigatórias

- Não reescrever o sistema do zero; preferir composição sobre substituição total.
- Não alterar schema, APIs ou regras de negócio sem necessidade demonstrada.
- Não introduzir Agenda, Mensagens, IA ou Relatórios avançados.
- Não apresentar fotografia de banco/IA como foto de aluno real.
- Usar somente as imagens registradas no manifesto (`assets/ASSET-MANIFEST.md` do pacote).
- Não reduzir cobertura de testes.
- Nenhum merge direto na `main` sem PR e gate verde.
- Documentação e código no mesmo PR.

## Lotes (cada um vira uma ou mais Histórias/PRs)

| Lote | Escopo | História(s) |
|---|---|---|
| A — Fundação | Tokens semânticos, `PulseLine`, shell responsivo, hero de abertura/login, sem alteração funcional | FIT-080 (mergeada, PR #75) + FIT-081 |
| B — Personal | Início, Alunos, Exercícios, Treinos/Programas, Financeiro, Perfil | FIT-082 |
| C — Aluno | Hoje, Sessão, Progresso, Perfil | FIT-083 |
| D — Consolidação | Mídia, acessibilidade, responsividade, temas, estados de exceção, regressão visual/funcional | FIT-084 |

## Gate final do Epic

Só está concluído quando todas as rotas de `docs/02-INVENTARIO-DE-TELAS.md` (cópia de referência abaixo) estiverem cobertas, a suíte de testes anterior continuar passando, todos os novos estados tiverem evidência visual real, e o Product Owner puder navegar as duas jornadas completas (Personal e Aluno) em homologação.

## Nota de transparência — validação profissional das imagens de exercício

`docs/06-GOVERNANCA-DE-MIDIA.md` e `assets/ASSET-MANIFEST.md` do próprio pacote já registram: validação profissional confirmada por Produto em 21/09/2026, mas sem nome/registro do profissional informado. O próprio manifesto declara que isso "não bloqueia a implementação autorizada por Produto". Registrado aqui apenas para rastreabilidade — não é uma lacuna introduzida por este Epic, e nenhuma ação adicional foi tomada sobre ela.

## Nota de transparência — divergência de nomenclatura de tokens

`docs/03-COMPONENTES-E-TOKENS.md` do pacote cita "Cloud `#F5F7F8`" e "Graphite `#26313D`" como tokens canônicos, mas os primitivos neutros já existentes em `tokens.css` usam valores levemente diferentes (`neutral-50 #F8FAFC`, `neutral-900 #18212B`). Como o próprio pacote instrui "não substituir valores semânticos já validados para contraste por cores puramente visuais do protótipo", os primitivos existentes foram mantidos e "Cloud"/"Graphite" tratados como nomes amigáveis para os mesmos papéis semânticos já aprovados — decisão registrada para julgamento do Product Owner, não uma alteração de contraste silenciosa.
