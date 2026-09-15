# FitOS — Governança de Produto e Entrega

## 1. Fonte oficial

O repositório `muriloalmeida-alt/New-FitOS` é a fonte oficial das decisões, requisitos e entregas do FitOS. Decisões relevantes devem ser registradas em Markdown dentro de `docs/` antes ou no mesmo PR que as implementa.

### Regra inviolável da `main`

- Commits, pushes e merges diretos na branch `main` são proibidos.
- Toda alteração, sem exceção — produto, design, código, documentação, configuração, infraestrutura, correção ou hotfix — deve chegar à `main` exclusivamente por Pull Request.
- Todo PR deve ser revisado e aprovado antes do merge.
- O autor não deve concluir o merge sem o aceite exigido para a entrega.
- Urgência não elimina o PR; hotfixes seguem o mesmo fluxo, com escopo e validação proporcionais ao risco.
- A proteção da branch deve impedir tecnicamente escrita direta e merge sem aprovação sempre que o plano e as permissões do GitHub permitirem.

### Formalização obrigatória no PR

- O PR é o registro oficial de cada entrega e deve conter Sprint, Épico, História, problema, solução, escopo, evidências, testes, riscos e impactos.
- Decisões permanentes também devem atualizar, no mesmo PR, o PRD, a regra de negócio, o ADR ou outro documento aplicável em `docs/`.
- Mensagens, conversas externas e comentários isolados não substituem a formalização no PR e nos documentos versionados.
- Um PR sem documentação suficiente deve permanecer aberto até a correção.

## 2. Papéis

| Papel | Responsável | Responsabilidade |
|---|---|---|
| Product Owner / Sponsor | Murilo Almeida | Visão, prioridade final, aceite e decisões comerciais |
| Product Manager e Product Designer | GPT do Murilo | PRDs, refinamento, critérios de aceite, experiência e validação funcional |
| Engenharia | Claude Code | Arquitetura, implementação, testes, documentação técnica e correções |

## 3. Hierarquia do trabalho

`Roadmap → Sprint → Épico → História → PR`

- **Roadmap:** direciona resultados e sequência macro.
- **Sprint:** janela de entrega com objetivo, escopo e resultado verificável.
- **Épico:** capacidade relevante do produto, composta por histórias.
- **História:** menor unidade funcional que entrega valor verificável.
- **PR:** unidade de mudança no repositório; implementa uma história ou parte explicitamente delimitada dela.

## 4. Identificadores

- Sprint: `SPRINT-XX`
- Épico: `EPIC-XX`
- História: `FIT-XXX`
- Correção: `BUG-XXX`
- Decisão: `ADR-XXX`

IDs nunca devem ser reutilizados.

## 5. Fluxo

1. Produto registra ou atualiza PRD, épico e histórias.
2. Murilo define prioridade e aprova o escopo da Sprint.
3. Engenharia refina dependências e riscos sem alterar silenciosamente o requisito.
4. Uma branch é aberta a partir de `main` para cada história.
5. A entrega e toda a sua formalização acontecem por PR com vínculo explícito à Sprint, ao Épico e à História.
6. Critérios de aceite, testes e documentação são verificados na revisão.
7. Somente após revisão e aprovação, o merge do PR encerra a entrega técnica; o aceite funcional encerra a história.
8. A Sprint recebe fechamento documentado com entregues, não entregues, riscos e próximos passos.

## 6. Convenções de branch

- `feat/FIT-XXX-resumo`
- `fix/BUG-XXX-resumo`
- `docs/FIT-XXX-resumo`
- `chore/FIT-XXX-resumo`

## 7. Convenção de PR

Título: `[FIT-XXX] Descrição objetiva`

Todo PR deve informar:

- Sprint e Épico.
- História ou bug relacionado.
- Problema e solução.
- Escopo incluído e excluído.
- Evidências e testes.
- Impactos em documentação, segurança, dados e deploy.
- Checklist da Definition of Done.

PRs sem história associada devem explicar a exceção. Não misturar histórias independentes no mesmo PR. Nenhuma exceção autoriza commit, push ou merge direto na `main`.

## 8. Estados recomendados

`Backlog → Refinada → Pronta → Em desenvolvimento → Em revisão → Homologação → Concluída`

Bloqueios devem registrar causa, responsável pela decisão e próximo passo.

## 9. Alterações de escopo

- Mudança relevante durante a Sprint deve atualizar história, PRD ou decisão aplicável.
- Ambiguidades encontradas pela Engenharia retornam para Produto.
- Requisito novo não entra silenciosamente em PR já iniciado.
- Item removido da Sprint deve constar no fechamento como não entregue ou replanejado.

## 10. Segurança

- Chaves e credenciais nunca entram em issues, PRs, commits ou documentos.
- Exemplos usam placeholders.
- Dados reais de alunos não podem ser usados como massa de teste versionada.
