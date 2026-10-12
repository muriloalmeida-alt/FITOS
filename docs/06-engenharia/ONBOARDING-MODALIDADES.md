# Seu jeito de treinar: modalidades no onboarding (proposta 11, 12/10/2026)

## Pergunta

- O texto é "Quais modalidades você quer praticar?", com a orientação "Escolha uma ou mais opções."
- São três cartões de seleção múltipla: Musculação, Funcional e CrossFit (`app/_modalidades/ModalityPicker.tsx`).
  - Cada cartão é inteiro clicável, com `role="checkbox"` e `aria-checked`.
  - A seleção aparece também como ✓, não só pela cor.
  - O alvo de toque tem pelo menos 64 px.
- "Continuar" só fica habilitado com pelo menos uma escolha. Qualquer combinação não vazia vale; não existe a opção "Ambos".
- **FitOS Livre**: a pergunta é a quarta etapa (objetivo, dias, experiência, modalidades), logo antes das recomendações.
  - As respostas ficam em `sessionStorage`, então voltar ou recarregar retoma de onde parou.
  - Tudo é gravado ao concluir, e a falha mantém as escolhas e permite tentar de novo. Antes da conta não há onde gravar no servidor.
- **Aluno com personal**: a pergunta vem depois do objetivo, no convite. É gravada ao continuar (`PATCH /api/minhas-modalidades`).
  - Em caso de falha, a seleção fica e o aluno pode tentar de novo.
  - Ao final aparece "Preferências salvas. {Personal} poderá usá-las no seu programa." O fluxo segue como antes.

## Dados

- **Ids estáveis**: `musculacao`, `funcional` e `crossfit` (`shared/lib/modalities.ts`); os nomes aparecem em português.
- **Coleções `text[]`**, não texto separado por vírgulas. Vazio significa "não definido".
  - `individual_profiles.modalities` guarda as do Livre.
  - `students.modalities` guarda as do aluno com personal.
  - `training_plans.modalities` guarda a classificação do programa.
- **Validação**: o servidor exige lista não vazia, sem duplicatas e com ids conhecidos (`parseModalities`). No banco, uma `CHECK (... <@ ARRAY[...])` recusa id desconhecido.
- **Alunos antigos**: ficam como "não definido". Nada é atribuído automaticamente e o programa atual não muda.

## Oferta e recomendação

- **Regra** (`offerable`): o conteúdo só entra se for classificado e se todas as modalidades declaradas estiverem entre as escolhidas. Conteúdo sem classificação nunca entra, e nada é inferido pelo nome.
- **Grupos** (`shared/lib/programRecommendation.ts`):
  - há um grupo por modalidade;
  - um programa misto só aparece se estiver cadastrado como misto e tiver todas as modalidades dele escolhidas, e nunca é gerado;
  - dentro do grupo, vem primeiro o nível igual ao da pessoa e depois a frequência mais perto da disponibilidade.
- **Musculação**: a primeira opção é o plano montado pelas três respostas (o comportamento de antes), seguido dos programas da biblioteca.
- **Cada opção mostra dados reais**: frequência, semanas, minutos e nível, quando cadastrados.
  - Tocar abre os detalhes: treinos, formato, exercícios e doses, aquecimento e carga.
  - A escolha só vale depois de "Escolher este programa".
- **Sem conteúdo** para uma modalidade, aparece "Ainda não temos programas disponíveis para esta modalidade". Se nenhuma tiver programas, aparece "Ajustar preferências".
- **"Você pode decidir depois."**: seguir sem programa cria o espaço sem treinos, no estado sem programa já existente.
- **Servidor**: `POST /api/onboarding` aceita `modalities` e `program` (`{kind:"inicial"}`, `{kind:"programa", key}` ou `null`).
  - Um programa incompatível com as modalidades é recusado antes de gravar qualquer coisa.
  - Só ativa programa num espaço vazio.
  - Clientes antigos, sem `program`, continuam recebendo o plano inicial.

## Programas de Funcional e CrossFit

- **Origem**: o material "FitOS — Funcional e CrossFit" v1, com 4 programas e 12 treinos, em `modules/library/modalityPrograms.ts`.
  - Os formatos são blocos (ADR-020): circuito, AMRAP, EMOM e For Time. Nunca são convertidos em séries.
  - A carga não é prescrita ("individualizada pelo personal"). As metas são repetições, tempo ou distância.
- **Catálogo**:
  - cada exercício é resolvido explicitamente, e faltar um aborta (`ModalityCatalogError`);
  - dois exercícios do material não existiam e entraram por migração, sem imagem: "Agachamento até o banco" e "Remada com elástico";
  - variações são anotadas no item: flexão adaptada (8–12), burpee sem salto, wall ball adaptado, degrau baixo, "remo ou bicicleta".
- **Personal**: a biblioteca inicial passa para a versão 3, que é aditiva, transacional e idempotente.
  - Quem tinha a v2 recebe só os 4 programas novos.
  - Os programas de musculação criados a partir de agora ficam classificados como `musculacao`.
  - Os programas já existentes nos espaços continuam sem classificação. Classificar por nome não é permitido.
- **Livre**: os programas aparecem na biblioteca pronta e na recomendação. Usar um deles copia os blocos e as metas.
- **Nada é aplicado automaticamente aos alunos.**

## Perfil e personal

- **Perfil → Meu treino**: mostra as modalidades. "Editar/Escolher modalidades" usa a mesma seleção e só salva com "Salvar modalidades"; "Cancelar" descarta.
  - Mudar atualiza as próximas recomendações e nunca o programa ativo.
- **Ficha do aluno, para o personal**: mostra "Modalidades: …".
  - Se o programa ativo for classificado com uma modalidade fora das escolhidas, aparece um aviso para revisar. O programa continua ativo e acessível.
  - O personal só lê alunos do próprio espaço (`getStudentModalities` filtra por tenant).
  - A rota de gravação aceita só o próprio aluno ou o Livre; o personal recebe 403.

## Dependências

- Nenhuma `FEATURE_` nova.
- A execução e a edição dos blocos dependem da `FEATURE_FUNCIONAL` (ADR-020), que é ligada por padrão.
- O Railway Agent não foi usado.
