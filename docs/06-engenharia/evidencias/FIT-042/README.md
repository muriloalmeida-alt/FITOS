# Evidências — FIT-042

Todas as capturas abaixo são reais: Playwright contra o build de produção (`npm run start`), com criação de conta de personal, cadastro de aluno, geração de convite e ativação de conta, registro de duas avaliações (peso, gordura, medidas, observação) através da UI real, e exclusão lógica de uma delas — tudo através da UI e das rotas reais, sem nenhum dado inserido diretamente no banco. Todos os usuários (personal e aluno), tenant e avaliações sintéticas foram removidos do banco após a captura.

## Estado vazio honesto, antes de qualquer avaliação

[Personal, ficha do aluno, mobile claro](personal-avaliacoes-vazio-mobile-claro.png): card "Avaliações e evolução" com "Nenhuma avaliação registrada ainda." e o formulário de registro.

[Aluno, "Progresso", mobile claro](aluno-progresso-vazio-mobile-claro.png): "Nenhuma avaliação registrada ainda. Fale com seu personal." — item "Progresso" da navegação do aluno deixa de ser "Em breve".

## Duas avaliações registradas pelo personal

[Mobile, tema claro](personal-avaliacoes-duas-mobile-claro.png) e [desktop, tema escuro](personal-avaliacoes-duas-desktop-escuro.png): "82.5kg · 18.5% de gordura · Cintura: 85cm, Braço: 36cm" e "80kg · 17% de gordura · Cintura: 83cm", cada uma com sua observação e o botão "Excluir" — histórico mais recente primeiro.

## Aluno vê a própria evolução: gráfico e tabela equivalentes

[Mobile, tema claro](aluno-progresso-com-grafico-mobile-claro.png) e [desktop, tema escuro](aluno-progresso-com-grafico-desktop-escuro.png): o gráfico de peso (SVG simples, sem biblioteca nova — `role="img"` com `aria-label` resumindo a tendência) aparece só a partir de duas avaliações com peso; a tabela completa (data, peso, gordura, medidas, observação) é sempre a fonte detalhada, nunca dependente do gráfico.

## Exclusão lógica: a avaliação some da listagem, mas nunca é removida fisicamente

[Personal, mobile claro](personal-avaliacoes-apos-excluir-mobile-claro.png): após excluir a "Primeira avaliação" (mais antiga), só "Segunda avaliação" permanece na lista — a exclusão marca `deletedAt`/`deletedByUserId` e registra `AuditEvent` (`AVALIACAO_EXCLUIDA`), nunca uma exclusão física (comprovado por teste real em `assessments.integration.test.ts`).

[Aluno, mobile claro](aluno-progresso-uma-avaliacao-mobile-claro.png): a própria evolução do aluno reflete a exclusão imediatamente — só uma avaliação na tabela, e o gráfico desaparece (menos de dois pontos).

## Resultado das validações

`npm run test` (507/507 — 8 novos testes de integração em `assessments.integration.test.ts` contra Postgres real; 8 novos testes de rota; 5 novos testes de `AvaliacoesSection.test.tsx`; 5 novos testes de `ProgressoPage`; `page.test.tsx` da ficha do aluno estendido com 2 novos casos) · `npm run lint` · `npm run typecheck` · `npm run build` (rotas `/painel/progresso`, `/api/students/[id]/avaliacoes` e `/api/students/[id]/avaliacoes/[assessmentId]` registradas) · `npm audit` (0 vulnerabilidades) — todos limpos. Migration aditiva `20260920030000_add_assessment_evolution` (`Assessment.bodyFatTenthPercent`/`notes`/`deletedAt`/`deletedByUserId`, nova tabela `BodyMeasurement`, índice único `assessments_id_tenantId_key`) testada em banco vazio (histórico completo do zero) e como atualização do schema atual (`fitos_dev`/`fitos_test`).
