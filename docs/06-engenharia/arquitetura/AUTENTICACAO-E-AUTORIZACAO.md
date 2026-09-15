# Autenticação e autorização

## Direção

Better Auth é o candidato primário; Clerk é fallback. A autorização de domínio e o isolamento do tenant pertencem ao FitOS, independentemente do provedor.

## Fluxos mínimos

- cadastro e acesso do personal;
- convite e ativação do aluno correto;
- recuperação de senha;
- encerramento e revogação de sessão;
- bloqueio de conta/vínculo sem apagar histórico;
- proteção de rotas e ações no servidor.

## Prova técnica obrigatória do Better Auth

Deve ocorrer em História/PR posteriores e demonstrar:

1. login, logout e recuperação de personal e aluno;
2. papéis `PERSONAL` e `ALUNO`;
3. criação e identificação segura do tenant;
4. aluno vinculado a um único personal;
5. isolamento usando dois tenants e usuários distintos;
6. tentativa de acesso cruzado rejeitada em leitura e escrita;
7. revogação e expiração de sessão;
8. compatibilidade com Next.js, PostgreSQL, Prisma e Railway;
9. comportamento de cookies, CSRF, redirects e segredos documentado;
10. evidências automatizadas e sem dados reais.

## Critério de decisão

- aprovado: ADR-002 muda para `Aceito` em PR;
- reprovado: executar prova equivalente com Clerk;
- inconclusivo: bloquear implementação dependente.

MFA, SSO corporativo, múltiplos personais por tenant e administração de academias são pós-MVP.
