# Evidências — FIT-053

Todas as capturas abaixo são reais: Playwright contra o build de produção (`npm run start`), com criação de conta de personal, cadastro de aluno, cadastro de três cobranças na competência atual (uma a vencer, uma atrasada, uma paga) e o filtro de competência explícito trocado para um mês sem nenhum lançamento — tudo através da UI e das rotas reais, sem nenhum dado inserido diretamente no banco. Todos os usuários (personal), tenant e cobranças sintéticas foram removidos do banco após a captura.

## Estado vazio honesto, antes de qualquer cobrança

[Mobile, tema claro](resumo-vazio-mobile-claro.png): "Visão geral" já com o filtro de competência explícito (mês atual selecionado por padrão) e os quatro indicadores zerados — nunca uma tela em branco por falta de filtro.

## Previsto, recebido, pendente e atrasado — com "atrasado" em destaque

[Mobile, tema claro](resumo-competencia-atual-mobile-claro.png) e [desktop, tema escuro](resumo-competencia-atual-desktop-escuro.png): três cobranças da mesma competência (R$ 80 a vencer, R$ 30 atrasada, R$ 100 paga) somam Previsto R$ 210,00, Recebido R$ 100,00, Pendente R$ 80,00 e Atrasado R$ 30,00 — o indicador "Atrasado — exige ação" em destaque (vermelho) permite identificar de imediato o lançamento que exige ação, exatamente como pedido pelo critério de aceite. Algarismos tabulares, como exigido por `CRITICAL-SCREEN-SPECS.md`.

## Filtro de competência explícito: uma competência sem nenhum lançamento nunca mistura dados de outro mês

[Mobile, tema claro](resumo-competencia-vazia-mobile-claro.png): ao trocar o filtro para um mês sem nenhuma cobrança, "Visão geral" e "Cobranças" voltam honestamente a zero/vazio — nunca reaproveitam os totais da competência anterior.

## Resultado das validações

`npm run test` (569/569 — 2 novos testes de integração em `charges.integration.test.ts` contra Postgres real, incluindo isolamento entre tenants no resumo; 1 novo teste de `page.test.tsx` do financeiro) · `npm run lint` · `npm run typecheck` · `npm run build` — todos limpos. Nenhuma migration nova (o resumo é só leitura agregada sobre `StudentCharge`/`Payment` já existentes).
