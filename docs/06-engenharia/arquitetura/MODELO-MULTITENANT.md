# Modelo multi-tenant e permissões

## Unidade de isolamento

Cada personal trainer representa um tenant no MVP. O aluno possui conta própria e vínculo ativo com exatamente um tenant. Uma futura relação do aluno com múltiplos personais exige nova decisão e migração planejada.

## Regras invioláveis

- registros de negócio carregam `tenant_id` quando pertencem ao domínio do personal;
- o servidor deriva tenant e usuário da sessão validada;
- `tenant_id` recebido do navegador nunca concede acesso;
- consultas, comandos, jobs e exports aplicam o tenant explicitamente;
- identificadores difíceis de adivinhar não substituem autorização;
- acesso de suporte administrativo não existe no MVP sem decisão, auditoria e controle próprios;
- testes negativos entre dois tenants são obrigatórios.

## Matriz de autorização

| Capacidade | Personal | Aluno |
|---|---:|---:|
| Administrar o próprio perfil | Sim | Sim |
| Administrar alunos do tenant | Sim | Não |
| Ver dados de outros alunos | Conforme função profissional | Não |
| Criar exercícios próprios e treinos | Sim | Não |
| Consultar treino atribuído | Sim | Próprio |
| Registrar execução | Consultar/corrigir conforme regra | Própria |
| Registrar avaliação | Sim | Não no MVP |
| Ver evolução | Alunos do tenant | Própria |
| Administrar financeiro dos alunos | Sim | Não |
| Ver situação financeira | Alunos do tenant | Própria, quando aplicável |
| Administrar assinatura FitOS | Proprietário | Não |

## Defesa em profundidade

Autorização na camada de aplicação é obrigatória. Controles adicionais no banco podem ser avaliados na prova técnica/modelagem física, mas não substituem testes e políticas do domínio.
