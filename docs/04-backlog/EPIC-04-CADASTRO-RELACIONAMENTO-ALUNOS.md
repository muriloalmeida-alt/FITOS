# EPIC-04 — Cadastro e Relacionamento com Alunos

## Resultado esperado

Sobre a base de identidade, autorização e shell entregue pela EPIC-03 (SPRINT-04), dar ao personal a gestão real de sua carteira de alunos — cadastro, listagem, perfil, ciclo de vida — e um caminho seguro para que o aluno cadastrado ative sua própria conta e acesse a experiência inicial do FitOS.

## Histórias

### FIT-013 (#31) — Cadastro e listagem de alunos — Concluída (PR #35, merged)

Como personal, quero cadastrar um aluno com nome e e-mail e encontrá-lo depois por busca, filtro e paginação, para começar a organizar minha carteira sem depender de nenhuma funcionalidade de negócio futura (treinos, avaliações, cobrança).

### FIT-014 (#32) — Perfil, edição e ciclo de vida do aluno — Concluída (PR #36, merged)

Como personal, quero consultar e editar os dados básicos de um aluno e poder inativá-lo e reativá-lo sem perder histórico, para manter minha carteira organizada sem apagar registros.

### FIT-015 (#33) — Convite e ativação da conta do aluno — Concluída (PR #37, merged)

Como personal, quero gerar um link de convite seguro, de uso único e com validade, para que o aluno cadastrado possa definir sua própria senha e ativar o acesso — sem que o aluno tenha cadastro público independente.

### FIT-016 (#34) — Experiência inicial do aluno — PR #38 (gate autônomo aprovado, merge por SHA exato em seguida)

Como aluno, quero entrar no FitOS e ver meu nome, meu personal/espaço vinculado e o estado da minha conta, para saber que meu acesso está funcionando, mesmo antes de existir qualquer treino ou avaliação atribuída a mim.

## Estado final

EPIC-04 concluído: as quatro Histórias (FIT-013 a FIT-016) foram implementadas, testadas e mergeadas em sequência, cada uma com PR próprio e gate autônomo registrado. Fechamento completo da Sprint em `docs/05-sprints/SPRINT-05-GESTAO-DE-ALUNOS.md`.

## Dependências

EPIC-03 — Identidade, Acesso e Navegação (#21), concluído: FIT-009 a FIT-012 mergeadas (PR #26/#27/#28/#29, commit final `3cde984609f344932a821bcb7bfd6e2bb5b74b5e`). `main` contém autenticação, sessão, papéis, tenant derivado da sessão e os shells autenticados de personal e aluno.

## Escopo

- cadastro de aluno pelo personal (nome e e-mail), sem envio automático de convite;
- listagem paginada no servidor, com busca por nome/e-mail e filtro por status;
- perfil do aluno, edição de nome, regra segura para alteração de e-mail;
- inativação e reativação, preservando histórico;
- geração, cópia, cancelamento e renovação de convite de ativação (link, não e-mail automático);
- ativação da conta pelo aluno (definição de senha, vínculo seguro ao `Student` correto);
- experiência inicial do aluno autenticado (nome, personal/espaço vinculado, estado da conta, logout).

## Fora do escopo

- exercícios, treinos, avaliações físicas, cobrança/pagamento, agenda, mensagens;
- envio automático de e-mail (o MVP entrega apenas o link para cópia manual);
- múltiplos personais por aluno, transferência de aluno entre tenants;
- qualquer papel adicional além de PERSONAL/ALUNO.

## Critérios de sucesso do Épico

- personal cadastra, busca, lista, edita, inativa e reativa alunos do próprio tenant — nunca de outro;
- convite é de uso único, com validade documentada, cancelável e renovável;
- aluno ativa a própria conta apenas com um convite válido, e autentica normalmente depois;
- aluno inativo tem o acesso normal bloqueado, sem perder o histórico;
- nenhuma operação usa `tenantId`/`studentId` vindo do cliente como fonte de autorização;
- nenhuma credencial, token de convite ou dado pessoal real é registrado em código, PR, Issue, log ou evidência;
- cada História possui PR próprio, com gate autônomo registrado e merge por SHA exato.

## Sequenciamento obrigatório

As Histórias não são paralelas: FIT-013 → (merge) → FIT-014 → (merge) → FIT-015 → (merge) → FIT-016 → (merge) → fechamento da SPRINT-05. Execução autônoma integral autorizada pelo Produto (SPRINT-05) — merge de cada PR ocorre após os quality gates aprovados, sem pausa intermediária entre Histórias.
