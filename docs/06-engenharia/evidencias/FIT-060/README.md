# Evidências — FIT-060

Todas as capturas abaixo são reais: Playwright contra o build de produção (`npm run start`), com criação de conta de personal, cadastro de dois alunos, criação de um modelo de treino e cadastro de uma cobrança já vencida (dado sintético, para provar "Atrasado este mês" real) através da UI real — tudo através da UI e das rotas reais, sem nenhum dado inserido diretamente no banco. Todos os usuários (personal), tenant, treino e cobrança sintéticos foram removidos do banco após a captura.

## Estado vazio honesto, antes de qualquer aluno/treino/cobrança

[Mobile, tema claro](inicio-vazio-mobile-claro.png): "Alunos ativos" e "Treinos ativos" em 0, "Atrasado este mês" em R$ 0,00 sem destaque — nunca um dado fictício no painel inicial do personal.

## Painel consolidado: alunos ativos, treinos ativos e situação financeira reais

[Mobile, tema claro](inicio-consolidado-mobile-claro.png) e [desktop, tema escuro](inicio-consolidado-desktop-escuro.png): após cadastrar 2 alunos, 1 modelo de treino e uma cobrança vencida de R$ 50,00, o "Início" do personal mostra exatamente esses números — "Alunos ativos: 2", "Treinos ativos: 1", "Atrasado este mês: R$ 50,00" em destaque — com os atalhos "+ Novo aluno", "+ Novo treino" e "Ver financeiro".

## Atalho real: "Ver financeiro" leva à mesma situação financeira mostrada no Início

[Mobile, tema claro](atalho-financeiro-mobile-claro.png): ao clicar em "Ver financeiro", a tela `/painel/financeiro` mostra os mesmos R$ 50,00 atrasados da competência atual — nenhuma divergência entre o resumo do "Início" e o resumo financeiro completo (ambos leem `getFinancialSummary`, FIT-053).

## Resultado das validações

`npm run test` (572/572 — 1 novo teste dedicado de `PainelPage`/`page.test.tsx` + 2 novos testes de `PersonalHome.test.tsx`) · `npm run lint` · `npm run typecheck` · `npm run build` — todos limpos. Nenhuma migration nova, nenhuma entidade nova — composição/leitura sobre alunos (`listStudents`, FIT-013), treinos (`listWorkoutsForTenant`, FIT-030) e financeiro (`getFinancialSummary`, FIT-053) já existentes.
