# EPIC-03 — Identidade, Acesso e Navegação

## Resultado esperado

Entregar a primeira experiência autenticada do FitOS: contas de personal trainer, acesso de alunos previamente vinculados, isolamento de tenant derivado da sessão (nunca do cliente), e a navegação autenticada mínima sobre a qual as funcionalidades de negócio (Alunos, Exercícios, Treinos, Financeiro) serão construídas.

## Histórias

### FIT-009 (#22) — Prova técnica e implementação da autenticação — Concluída (PR #26, merged)

Como time do FitOS, queremos validar tecnicamente o Better Auth e, se aprovado, implementar a fundação de autenticação (cadastro de personal, login, logout, sessão server-side, proteção de rota), para que o produto tenha uma base de identidade real antes de qualquer funcionalidade de negócio.

### FIT-010 (#23) — Provisionamento do tenant do personal — Concluída (PR #27, merged)

Como time do FitOS, queremos que cada personal autenticado receba exatamente um tenant, criado automaticamente e de forma idempotente, para que a regra "1 personal = 1 tenant" seja garantida também no fluxo de cadastro, não apenas na constraint física.

### FIT-011 (#24) — Autorização, papéis e isolamento por sessão — Concluída (PR #28, merged)

Como time do FitOS, queremos uma camada central de autorização que derive userId/role/tenantId da sessão autenticada no servidor, para que nenhuma rota ou operação aceite tenantId vindo do cliente como fonte de autorização.

### FIT-012 (#25) — Shell autenticado e navegação responsiva — Concluída (PR #29, merged). Encerra a SPRINT-04.

Como time do FitOS, queremos a estrutura visual autenticada (shell de personal e de aluno), aplicando o Design System M3 já aprovado, para que a navegação exista de forma real e responsiva sem simular funcionalidades ainda não implementadas.

## Dependências

EPIC-02 — Fundação Técnica (#10), concluído: FIT-006, FIT-007 e FIT-008 mergeadas. `main` contém a aplicação executável, o modelo físico multi-tenant e o ambiente de homologação Railway.

## Escopo

- prova técnica formal do Better Auth (ADR-002), com decisão fundamentada (Aceito ou rejeitado com alternativa recomendada);
- cadastro e login de personal trainer; login de aluno (sem cadastro público);
- sessão segura, acessível no servidor;
- provisionamento automático e idempotente do tenant do personal;
- contexto de autorização (userId, role, tenantId) derivado da sessão, nunca do cliente;
- isolamento entre tenants e entre alunos testado com cenários negativos reais;
- shell autenticado mínimo (personal e aluno), responsivo, com temas claro/escuro, sem simular funcionalidades futuras;
- logout e tratamento de sessão expirada/inválida.

## Fora do escopo

- OAuth, login social, MFA, passkeys, recuperação de senha por SMS;
- gestão completa de Alunos, Exercícios, Treinos, Financeiro;
- convite real por e-mail (salvo se indispensável ao mecanismo de autenticação escolhido);
- assinatura SaaS, cobrança, permissões avançadas, múltiplos personais por tenant, administração de academias, superadministrador, impersonação;
- qualquer funcionalidade de negócio alem da estrutura mínima de acesso e navegação.

## Critérios de sucesso do Épico

- ADR-002 recebe decisão final (Aceito ou rejeição fundamentada) antes de qualquer implementação dependente ser tratada como consolidada;
- personal recebe exatamente 1 tenant, de forma idempotente e sem depender de client-provided IDs;
- aluno nunca cria tenant e nunca acessa dados de outro tenant/aluno;
- toda autorização de acesso ocorre no servidor, derivada da sessão;
- nenhuma tela apresenta funcionalidade futura como se estivesse pronta;
- Design System M3 aprovado é respeitado, com suporte a tema claro/escuro e mobile first;
- nenhuma credencial, token ou segredo é registrado em código, PR, Issue ou log.

## Sequenciamento obrigatório

As Histórias não são paralelas: FIT-009 → (merge) → FIT-010 → (merge) → FIT-011 → (merge) → FIT-012 → (merge) → fechamento da SPRINT-04. Cada merge exige aprovação explícita de Produto/Design/Gate Técnico com SHA exato — não há merge automático entre Histórias.
