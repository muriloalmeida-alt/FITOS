# Módulo: Identidade

Responsabilidade (ver `docs/06-engenharia/arquitetura/VISAO-ARQUITETURAL.md`): usuários, sessões, recuperação e convite.

A partir da FIT-009, este módulo contém a integração real com o Better Auth: `auth.ts` (servidor), `auth-client.ts` (cliente), `session.ts` (`getServerSession`). Nenhum outro módulo deve importar `better-auth` diretamente — sempre por estes arquivos. Convite/vínculo de aluno e o contexto completo de autorização (userId/role/tenantId) são escopo da FIT-010/FIT-011. Detalhes em `docs/06-engenharia/arquitetura/AUTENTICACAO-E-SESSAO.md`.
