# Evidências — FIT-031

Todas as capturas abaixo são reais: Playwright contra o build de produção (`npm run start`), com criação de conta de personal, criação de modelo, adição de exercício, duplicação e edição da cópia todos feitos através da UI e das rotas reais. O único exercício referenciado ("Supino reto fit031run1") foi inserido diretamente via Prisma só para existir algo a selecionar no picker — mesma ressalva já documentada nas evidências da FIT-023/FIT-030. Todo o usuário, tenant, modelos e exercício sintéticos foram removidos do banco após a captura.

## Modelo original, antes de duplicar

[Mobile, tema claro](modelo-original-antes-de-duplicar-mobile-claro.png): "Treino A fit031run1" com um item ("Supino reto fit031run1 · peito · 3 séries · 10 repetições").

## Modelo duplicado

[Mobile, tema claro](modelo-duplicado-mobile-claro.png) e [desktop, tema escuro](modelo-duplicado-desktop-escuro.png): "Treino A fit031run1 (cópia)" — nome com o sufixo de cópia, mesmo item ("Supino reto fit031run1 · 3 séries · 10 repetições") copiado integralmente para a nova entidade.

## Catálogo com o original e a cópia

[Mobile, tema claro](modelos-original-e-copia-mobile-claro.png): "2 modelos de treino" — "Treino A fit031run1" e "Treino A fit031run1 (cópia)" listados como entidades independentes.

## Cópia editada não afeta o original

[Mobile, tema claro](copia-editada-mobile-claro.png): nome da cópia alterado para "Treino A fit031run1 (cópia) — editado", com "Alterações salvas." — o item permanece intacto.

## Original permanece inalterado

[Mobile, tema claro](original-inalterado-mobile-claro.png): revisitando o modelo original diretamente pela URL salva antes da duplicação — nome e item exatamente como antes, comprovando que a edição da cópia (acima) não teve nenhum efeito sobre ele. Nenhum vínculo de atualização automática entre as duas entidades.

## Resultado das validações

`npm run test` (338/338 — 4 novos testes de integração em `workouts.integration.test.ts` contra Postgres real, incluindo a prova explícita de independência bidirecional entre original e cópia; 3 novos testes de rota; 1 nova asserção de página) · `npm run lint` · `npm run typecheck` · `npm run build` (rota `/api/workouts/[id]/duplicar` registrada) · `npm audit` (0 vulnerabilidades) — todos limpos. Nenhuma migration nesta História — reaproveita o schema já entregue pela FIT-030.
