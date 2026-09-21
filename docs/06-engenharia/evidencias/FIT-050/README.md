# Evidências — FIT-050

Todas as capturas abaixo são reais: Playwright contra o build de produção (`npm run start`), com criação de conta de personal, cadastro de aluno e cadastro de duas cobranças (uma com vencimento futuro, outra já vencida — dado sintético para provar a transição de estado) através da UI real, seguido do cancelamento de uma delas com motivo — tudo através da UI e das rotas reais, sem nenhum dado inserido diretamente no banco. Todos os usuários (personal), tenant e cobranças sintéticas foram removidos do banco após a captura.

## Estado vazio honesto, antes de qualquer cobrança

[Mobile, tema claro](financeiro-vazio-mobile-claro.png): "Nenhuma cobrança cadastrada ainda." e o formulário de cadastro — item "Financeiro" da navegação do personal deixa de ser "Em breve".

## Duas cobranças, com os dois estados calculados/persistidos coexistindo

[Mobile, tema claro](financeiro-duas-cobrancas-mobile-claro.png) e [desktop, tema escuro](financeiro-duas-cobrancas-desktop-escuro.png): "Mensalidade outubro" (vencimento futuro) exibe o rótulo "A vencer" (apresentação calculada sobre `pendente`, nunca um estado armazenado); "Mensalidade setembro" (vencimento em 01/09/2026, já passado na data real da captura) exibe "Atrasado" — a transição `pendente` → `atrasado` foi aplicada de forma auto-contida (`refreshOverdueCharges`) na própria leitura da página, sem nenhum job em segundo plano.

## Cancelamento exige motivo, e nunca equivale a pagamento

[Mobile, tema claro](financeiro-apos-cancelar-mobile-claro.png): após cancelar a "Mensalidade setembro" informando o motivo, o cartão passa a exibir "Cancelado" e o motivo registrado, e o botão "Cancelar" desaparece (ação já concluída) — nunca uma exclusão física (comprovado por teste real em `charges.integration.test.ts`).

## Resultado das validações

`npm run test` (534/534 — 8 novos testes de integração em `charges.integration.test.ts` contra Postgres real; 10 novos testes de rota; 5 novos testes de `FinanceiroSection.test.tsx`; 3 novos testes de `page.test.tsx` do financeiro) · `npm run lint` · `npm run typecheck` · `npm run build` (rotas `/painel/financeiro`, `/api/students/[id]/cobrancas` e `/api/cobrancas/[id]/cancelar` registradas) — todos limpos. Migration aditiva `20260921000000_add_student_charge_and_payment` (`StudentCharge.description`/`referenceMonth`/`cancelReason`/`cancelledAt`, nova tabela `payments` — usada só a partir da FIT-051) testada em banco vazio (histórico completo do zero) e como atualização do schema atual (`fitos_dev`/`fitos_test`, com backfill das 2 linhas sintéticas do seed original da FIT-007).
