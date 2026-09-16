# Evidências — FIT-011

Esta História não introduz nenhuma tela nova (é uma camada de servidor) — não há captura de UI. A prova de ponta a ponta foi feita via HTTP real contra um build de produção real (`npm run start`), com cadastro/login reais e cookies de sessão reais (não simulados), reproduzida abaixo. Nenhum dado sintético usado permaneceu no banco após a execução.

## Prova real de ponta a ponta, via HTTP contra o build de produção

Servidor real em `http://localhost:3000` (`npm run start`), confirmado ativo via `GET /api/health` → 200.

### Sem sessão

```
GET /api/auth/context          -> 401 {"authenticated":false}
```

### Personal autenticado (cadastro real via `/api/auth/sign-up/email`, cookie de sessão real)

```
GET /api/auth/context          -> 200 {"authenticated":true,"role":"PERSONAL","tenantId":"cmu3ipg4v...","studentId":null}
GET /api/tenancy/meu-tenant    -> 200 {"id":"cmu3ipg4v...","name":"Espaço de Smoke"}
GET /api/tenancy/meu-tenant?tenantId=outro-tenant-qualquer
                                -> 200 {"id":"cmu3ipg4v...","name":"Espaço de Smoke"}  (parâmetro adulterado ignorado — mesmo tenant real)
GET /api/tenancy/meu-perfil    -> 403 {"error":"FORBIDDEN"}
```

### Aluno autenticado (usuário e vínculo criados diretamente no banco — não há cadastro público de aluno, FIT-009 — login real via `/api/auth/sign-in/email`, cookie de sessão real)

```
GET /api/auth/context          -> 200 {"authenticated":true,"role":"ALUNO","tenantId":"cmu3ipg4v...","studentId":"cmu3iqirs..."}
GET /api/tenancy/meu-perfil    -> 200 {"id":"cmu3iqirs...","displayName":"Smoke Aluno"}
GET /api/tenancy/meu-perfil?studentId=outro-aluno-qualquer
                                -> 200 {"id":"cmu3iqirs...","displayName":"Smoke Aluno"}  (parâmetro adulterado ignorado — mesmo aluno real)
GET /api/tenancy/meu-tenant    -> 403 {"error":"FORBIDDEN"}
```

Todos os 9 resultados coincidem exatamente com o esperado pela Issue #24: autenticação exigida, papel e tenant nunca alteráveis pelo cliente, 401/403 usados de forma coerente. Ao final, o usuário personal, o usuário aluno, o tenant e o `Student` sintéticos foram removidos do banco de desenvolvimento (`fitos_dev`) e o servidor foi encerrado.

## Prova automatizada

`src/modules/tenancy/authContext.integration.test.ts` (PostgreSQL real, banco de testes) e os três `route.test.ts` (`/api/auth/context`, `/api/tenancy/meu-tenant`, `/api/tenancy/meu-perfil`) cobrem os mesmos cenários de forma automatizada e repetível — ver `docs/06-engenharia/arquitetura/AUTORIZACAO-E-PAPEIS.md`, seção "Testes".

## Resultado das validações

`npm ci` (instalação limpa), `npx prisma validate`/`generate`, `npm run lint`, `npm run typecheck`, `npm run test` (**76/76**, 21 novos: 12 de `authContext.integration.test.ts` + 9 de `route.test.ts` das três rotas), `npm run build` e `npm audit` (0 vulnerabilidades) — todos limpos.
