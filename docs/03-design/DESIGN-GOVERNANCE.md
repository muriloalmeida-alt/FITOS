# Governança de Design e Entrega — FitOS

## Regra principal

**Merges diretos na `main` são proibidos.** Toda mudança de design, código ou documentação passa por Issue, branch, Pull Request, revisão e critérios de aceite — conforme `docs/00-governanca/GOVERNANCA.md`, que prevalece sobre este documento em qualquer conflito de identificadores, branch ou convenção de PR.

## Papéis

- **Product Manager:** prioriza problema, resultado e escopo.
- **Product Design:** pesquisa, fluxo, UI, conteúdo, protótipo e QA visual.
- **Engenharia/Claude Code:** viabilidade, implementação, testes e documentação técnica.
- **Aprovador do produto:** valida decisões com impacto de marca ou escopo.

## Fluxo obrigatório

1. Criar Issue de História vinculada à Sprint e ao Épico correspondentes, usando os identificadores de `docs/00-governanca/GOVERNANCA.md` (`FIT-XXX`/`EPIC-XX`/`SPRINT-XX`) — nunca numeração solta de Issue.
2. Registrar problema, público, hipótese, escopo e critérios de aceite.
3. Criar branch a partir da `main` atualizada, seguindo a convenção já fixada em `GOVERNANCA.md` (`feat/FIT-XXX-resumo`, `fix/BUG-XXX-resumo`, `docs/FIT-XXX-resumo` ou `chore/FIT-XXX-resumo`).
4. Produzir ou implementar a mudança.
5. Atualizar documentação no mesmo branch.
6. Abrir PR com título `[FIT-XXX] Descrição objetiva`, evidências visuais e testes.
7. Executar revisão de Produto, Design e Engenharia conforme impacto.
8. Corrigir pendências.
9. Aprovar e realizar merge pelo fluxo autorizado.
10. Registrar decisão e resultado.

## Nomenclatura

> **Nota de reconciliação (2026-09-15):** a versão original deste pacote propunha uma convenção própria (`branch: design/issue-123-...`, `PR: [Design][#123] ...`). O Product Owner decidiu manter uma única fonte de verdade de identificadores, branches e títulos de PR em todo o projeto, incluindo mudanças de design — a convenção de `docs/00-governanca/GOVERNANCA.md`. A nomenclatura própria deste pacote foi descartada.

Exemplo aplicado: uma história de design vinculada a `FIT-030` usa branch `feat/FIT-030-builder-treino` e PR `[FIT-030] Builder de treino — estados e responsividade`.

## Template mínimo de Issue de design

Campos que **complementam** os já exigidos no template de História (`.github/ISSUE_TEMPLATE/historia.md`) e a identificação de Sprint/Épico — não os substituem:

```md
## Problema
## Público e contexto
## Resultado esperado
## Escopo
## Fora de escopo
## Hipóteses
## Fluxos e estados
## Critérios de aceite
## Métricas
## Dependências
## Referências
```

## Template mínimo de PR

Campos que **complementam** o template padrão de PR (`.github/pull_request_template.md`); título e identificação de Sprint/Épico/História seguem `GOVERNANCA.md`:

```md
## Telas/breakpoints afetados
## Antes e depois
## Estados validados
## Acessibilidade
## Eventos de analytics
```

## Revisões obrigatórias

| Tipo de mudança | Produto | Design | Engenharia |
|---|---:|---:|---:|
| Copy simples | opcional | obrigatório | opcional |
| Componente/tokens | recomendado | obrigatório | obrigatório |
| Fluxo crítico | obrigatório | obrigatório | obrigatório |
| Financeiro/permissão | obrigatório | obrigatório | obrigatório |
| IA/recomendação (pós-MVP) | obrigatório | obrigatório | obrigatório |

## QA visual

- Comparar implementação com especificação.
- Validar 360, 768, 1024 e 1440 px.
- Verificar temas claro e escuro.
- Exercitar estados de loading, vazio, erro, sucesso e falha de conexão.
- Testar conteúdo longo.
- Navegar por teclado.
- Registrar screenshots no PR.

## Gestão de decisões

Mudanças relevantes em marca, tokens, arquitetura, componentes ou regras de negócio exigem ADR/registro de decisão contendo contexto, opções, decisão, consequências, data e aprovador — usando o identificador `ADR-XXX` de `GOVERNANCA.md`.

## Versionamento do Design System

- Patch: correção visual sem quebra.
- Minor: novo componente ou variante compatível.
- Major: mudança incompatível de token, API ou comportamento.

Deprecações devem ter substituto, prazo e plano de migração.

## Assets visuais de referência

- Assets visuais de referência conceitual (ex.: pranchas/concept boards) são **opcionais** e **não bloqueiam o aceite** de uma História — não são especificação pixel-perfect, apenas apoio de comunicação da direção de marca.
- Não recriar nem converter um asset binário usando ferramentas de escrita de texto: o risco de corrupção silenciosa no histórico do Git é maior que o valor de tê-lo versionado por essa via. Prefira um caminho com suporte binário nativo (upload direto por quem tem acesso, ou ferramenta compatível) quando o asset for necessário no repositório.

## Segurança documental

- Nunca versionar credenciais, tokens ou chaves de API.
- Usar placeholders em exemplos.
- Não incluir dados reais de alunos.
- A chave da API-Ninjas deve ser tratada como segredo de ambiente e nunca chegar ao cliente web.
