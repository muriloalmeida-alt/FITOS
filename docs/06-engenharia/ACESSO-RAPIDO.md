# Acesso rápido (proposta 7, aprovada em 11/10/2026)

## Comportamento

O botão **+** fica no canto inferior direito, acima da navegação inferior e da área segura, em todas as telas logadas do painel.
- **Não aparece** no treino ao vivo, no registro de treino passado, nos primeiros passos, na administração e para conta bloqueada.
- **Some** enquanto a modal está aberta e recebe o foco de volta ao fechar.

A modal é inferior e compacta, sem título visível (nome acessível "Ações disponíveis"). Ela fecha pelo ×, por um toque fora, pela tecla Escape e arrastando a alça para baixo. Ao escolher uma ação, a modal fecha e o app abre o destino; toques duplicados ficam bloqueados.

## Ações por perfil

As ações são calculadas no servidor (`GET /api/acesso-rapido`) quando a modal abre. Esconder um atalho não substitui a autorização de cada rota.

| Perfil | Ações |
|---|---|
| Personal | Aplicar programa (`/painel/treinos?aba=programas`) · Montar treino (`/painel/treinos/novo`) · Convidar aluno (`/painel/alunos/convite`) |
| Aluno com personal | Continuar treino (sessão em andamento) **ou** Começar treino (treino do dia → treino ao vivo; dia livre → programa) **ou** Ver meu programa (sem programa) · Meus treinos (`/painel/treino`) |
| FitOS Livre | Continuar treino **ou** Começar treino (treino do dia) **ou** Escolher programa (biblioteca) · Registrar treino passado (com `FEATURE_RETROATIVO`; sem ela, Meus treinos) |
| Aluno sem vínculo ativo, admin | Sem botão |

O antigo + do Início do personal (6 ações, campo de texto e recebimento) foi substituído: a proposta tira as opções financeiras desta versão.

## Arquivos

- `src/app/painel/_quick/quickActions.ts`: regras por perfil.
- `src/app/painel/_quick/QuickAccess.tsx`: o botão e a modal.
- `src/app/api/acesso-rapido/route.ts`: a rota.
- `src/shared/ui/Sheet.tsx`: opção `compact`, para a modal sem título com × e alça arrastável.
