# Evidências — FIT-010

[Painel com o tenant provisionado automaticamente](painel-com-tenant.png) — capturado com Playwright contra o build de produção real: cadastro em `/criar-conta` → redirecionamento → `/painel` exibindo o card "Seu espaço" com o nome gerado automaticamente ("Espaço de Joana", a partir do primeiro nome informado no cadastro). Não é uma tela editada manualmente; usuário e tenant sintéticos removidos do banco após a captura.

## Prova real do fluxo, via teste automatizado de ponta a ponta

`src/modules/tenancy/ensureTenantForPersonal.integration.test.ts`, suíte "provisionamento automático no cadastro real (FIT-009 + FIT-010 integrados)": cria uma conta real via `auth.api.signUpEmail` contra PostgreSQL real e confirma, imediatamente depois — sem nenhuma chamada adicional do teste — que o tenant já existe, com o nome esperado (`"Espaço de Personal"`, derivado do primeiro nome informado no cadastro). Essa é a evidência mais forte de que o hook de provisionamento funciona de ponta a ponta, mais direta do que uma captura de tela.

## Resultado das validações

`npm run lint`, `npm run typecheck`, `npm run test` (55/55 — 10 novos: 6 de `ensureTenantForPersonal.integration.test.ts`, 3 de `provisionTenant.test.ts`, mais o hook de cadastro end-to-end), `npm run build` e `npm audit` (0 vulnerabilidades) — todos limpos. Detalhes completos no PR desta História.
