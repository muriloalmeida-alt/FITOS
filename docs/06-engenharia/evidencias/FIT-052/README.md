# Evidências — FIT-052

Todas as capturas abaixo são reais: Playwright contra o build de produção (`npm run start`), com criação de conta de personal, cadastro de aluno, cadastro de uma cobrança recorrente, geração de duas competências independentes e encerramento da recorrência através da UI real — tudo através da UI e das rotas reais, sem nenhum dado inserido diretamente no banco. Todos os usuários (personal), tenant, cobranças e recorrência sintéticos foram removidos do banco após a captura.

## Recorrência cadastrada, ainda sem nenhum lançamento gerado

[Mobile, tema claro](recorrencia-cadastrada-mobile-claro.png) e [desktop, tema escuro](recorrencia-cadastrada-desktop-escuro.png): a seção "Cobranças" (card superior) está vazia — criar a recorrência não gera nenhum `StudentCharge` por si só; a seção "Cobranças recorrentes" (card inferior) mostra "Aluno Recorrencia · Mensalidade recorrente · R$ 150,00 · vence todo dia 5", com "Gerar cobrança do mês" e "Encerrar".

## Dois cliques em "Gerar cobrança do mês": duas competências independentes

[Mobile, tema claro](recorrencia-duas-competencias-mobile-claro.png): a seção "Cobranças" passa a mostrar duas cobranças da mesma recorrência — "Competência: outubro de 2026" ("A vencer") e "Competência: setembro de 2026" ("Atrasado") — cada uma com seu próprio "Registrar pagamento"/"Cancelar" independente, comprovando que cada geração é um lançamento físico próprio, nunca uma referência viva à recorrência.

## Encerrar a recorrência nunca afeta os lançamentos já gerados

[Mobile, tema claro](recorrencia-encerrada-mobile-claro.png): após "Encerrar", a seção "Cobranças recorrentes" volta a mostrar "Nenhuma cobrança recorrente ativa ainda." (a recorrência agora é `ENCERRADA`, fora da listagem de ativas — nunca excluída fisicamente), enquanto as duas cobranças já geradas na seção "Cobranças" continuam exatamente como estavam, com todas as suas ações disponíveis — comprovado também por teste real em `charges.integration.test.ts`.

## Resultado das validações

`npm run test` (566/566 — 5 novos testes de integração em `charges.integration.test.ts` contra Postgres real, incluindo a defesa física contra geração duplicada da mesma competência via índice único; 11 novos testes de rota; 5 novos testes de `RecorrenciasSection.test.tsx`; 1 novo teste de `page.test.tsx` do financeiro) · `npm run lint` · `npm run typecheck` · `npm run build` (rotas `/api/students/[id]/recorrencias`, `/api/recorrencias/[id]/gerar` e `/api/recorrencias/[id]/encerrar` registradas) — todos limpos. Migration aditiva `20260921010000_add_charge_recurrence` (nova tabela `charge_recurrences`; `StudentCharge.recurrenceId` e o índice único `student_charges_recurrenceId_referenceMonth_key`) testada em banco vazio (histórico completo do zero) e como atualização do schema atual (`fitos_dev`/`fitos_test`).
