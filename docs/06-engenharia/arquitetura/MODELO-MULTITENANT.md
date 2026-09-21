# Modelo multi-tenant e permissões

## Unidade de isolamento

Cada personal trainer representa um tenant no MVP. O aluno possui conta própria e vínculo ativo com exatamente um tenant. Uma futura relação do aluno com múltiplos personais exige nova decisão e migração planejada.

**Atualização (FIT-100, EPIC-13 — FitOS Livre)**: um tenant passou a ter um `type` (`PERSONAL` ou `INDIVIDUAL`, `@default(PERSONAL)` — ver `ADR-006-WORKSPACE-INDIVIDUAL.md`). Um tenant `INDIVIDUAL` é dono de uma pessoa que treina sozinha, sem personal, e usa exatamente a mesma unidade de isolamento (mesmas constraints físicas, mesmos triggers, mesmo `assertTenantAccess`) — não é um conceito novo, só um segundo tipo de dono. Todo o parágrafo acima permanece verdadeiro para tenants `PERSONAL`, sem nenhuma mudança de comportamento.

## Regras invioláveis

- registros de negócio carregam `tenant_id` quando pertencem ao domínio do personal;
- o servidor deriva tenant e usuário da sessão validada;
- `tenant_id` recebido do navegador nunca concede acesso;
- consultas, comandos, jobs e exports aplicam o tenant explicitamente;
- identificadores difíceis de adivinhar não substituem autorização;
- acesso de suporte administrativo não existe no MVP sem decisão, auditoria e controle próprios;
- testes negativos entre dois tenants são obrigatórios.

## Matriz de autorização

| Capacidade | Personal | Aluno | Individual (FIT-100) |
|---|---:|---:|---:|
| Administrar o próprio perfil | Sim | Sim | Sim |
| Administrar alunos do tenant | Sim | Não | Não (não tem aluno) |
| Ver dados de outros alunos | Conforme função profissional | Não | Não (não tem aluno) |
| Criar exercícios próprios e treinos | Sim | Não | Sim, para o próprio treino (FIT-102) |
| Consultar treino atribuído | Sim | Próprio | Próprio |
| Registrar execução | Consultar/corrigir conforme regra | Própria | Própria |
| Registrar avaliação | Sim | Não no MVP | Não decidido (fora do escopo da FIT-100) |
| Ver evolução | Alunos do tenant | Própria | Própria |
| Administrar financeiro dos alunos | Sim | Não | Não (não tem aluno) |
| Ver situação financeira | Alunos do tenant | Própria, quando aplicável | Não aplicável (sem cobrança do EPIC-12 nesta fase) |
| Administrar assinatura FitOS | Proprietário | Não | Proprietário |

A coluna "Individual" reflete só o que `requireIndividual()` (FIT-011/FIT-100) já garante hoje — a autorização em si, não a existência de nenhuma tela; as capacidades concretas de treino chegam História por História a partir da FIT-101.

## Defesa em profundidade

Autorização na camada de aplicação é obrigatória. Controles adicionais no banco podem ser avaliados na prova técnica/modelagem física, mas não substituem testes e políticas do domínio.
