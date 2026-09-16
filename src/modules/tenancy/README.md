# Módulo: Tenancy

Responsabilidade: personal, vínculos e contexto do tenant (`docs/06-engenharia/arquitetura/MODELO-MULTITENANT.md`).

Regra inviolável: `tenant_id` é sempre derivado no servidor a partir da sessão autenticada, nunca aceito do cliente.

## Modelo físico (FIT-007)

O modelo físico multi-tenant (`Tenant`, `User`, `Student`) está definido em `prisma/schema.prisma` e documentado em `docs/06-engenharia/arquitetura/MODELO-FISICO-DE-DADOS.md`. Constraints físicas garantem 1 personal = 1 tenant e aluno vinculado a exatamente 1 tenant. Testes de isolamento em `isolation.integration.test.ts`.

Ainda não implementado nesta História (fora do escopo): derivação de `tenant_id` a partir de uma sessão autenticada real (depende da prova técnica de autenticação) e qualquer rota/serviço de aplicação que consuma esse contexto.
