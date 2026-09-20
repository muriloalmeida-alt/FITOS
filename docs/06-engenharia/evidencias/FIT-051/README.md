# Evidências — FIT-051

Todas as capturas abaixo são reais: Playwright contra o build de produção (`npm run start`), com criação de conta de personal, cadastro de aluno, cadastro de uma cobrança e registro do respectivo pagamento (data, valor recebido, forma de pagamento) através da UI real — tudo através da UI e das rotas reais, sem nenhum dado inserido diretamente no banco. Todos os usuários (personal), tenant, cobrança e pagamento sintéticos foram removidos do banco após a captura.

## Formulário de pagamento

[Mobile, tema claro](financeiro-form-pagamento-mobile-claro.png): ao clicar em "Registrar pagamento" na cobrança pendente, abre o formulário com valor recebido, data do pagamento e forma de pagamento — mutuamente exclusivo com o formulário de cancelamento (mesma linha nunca mostra os dois ao mesmo tempo).

## Cobrança paga, com histórico do pagamento sempre visível

[Mobile, tema claro](financeiro-paga-mobile-claro.png) e [desktop, tema escuro](financeiro-paga-desktop-escuro.png): após confirmar, o cartão passa a exibir "Pago" e a linha "Pago em 04/10/2026 · R$ 150,00 · PIX" — o registro em `Payment` (entidade própria, nunca campos soltos em `StudentCharge`) preserva esse histórico; nem "Registrar pagamento" nem "Cancelar" continuam disponíveis (ação já concluída).

## Resultado das validações

`npm run test` (544/544 — 3 novos testes de integração em `charges.integration.test.ts` contra Postgres real, incluindo a defesa física contra um segundo pagamento para a mesma cobrança; 5 novos testes de rota; 2 novos testes de `FinanceiroSection.test.tsx`) · `npm run lint` · `npm run typecheck` · `npm run build` (rota `/api/cobrancas/[id]/pagamentos` registrada) — todos limpos. Nenhuma migration nova (a tabela `payments` já existia desde a migration da FIT-050, sem nenhuma linha até este código).
