# Perfil remodelado (proposta 10, aprovada em 11/10/2026)

## Estrutura

- **Cabeçalho**: logo e o título "Meu perfil".
  - O avatar do cabeçalho não aparece nesta página (`AppShell hideAccount`).
  - A identidade traz foto editável (`AvatarPicker`, galeria/câmera), nome, e-mail e o produto ou vínculo da conta.
- **Dois grupos de linhas compactas**: ícone, título, resumo e ›.
  - A linha inteira é clicável.
  - Os detalhes abrem em modais inferiores com título e × (`Sheet closable`). Elas fecham por ×, por um toque fora ou por Escape, e o foco volta à linha de origem.
- **Sair da conta** fica ao final e usa o logout existente, que leva a `/entrar`.

## Por perfil

| Perfil | Grupo 1 | Conta |
|---|---|---|
| FitOS Livre | Treino e rotina: Meu treino (respostas do onboarding, salvam no toque), Dias de treino, Lembrete de treino | Meus dados (nome, e-mail, nome do espaço) · Minha assinatura · Entrar com biometria · Termos e privacidade |
| Aluno com personal | Treino e rotina: Meu personal (dados do personal e indicação), Dias de treino, Lembrete de treino, Ficha de saúde | Meus dados (nome e e-mail; **sem** o espaço do personal) · Entrar com biometria · Termos e privacidade. Sem assinatura: o FitOS não cobra o aluno. |
| Personal | Seu negócio: Financeiro, Exercícios, Configurações (os avisos deste aparelho ficam em Configurações) | Meus dados (nome, e-mail, nome do espaço, perfil profissional) · Minha assinatura · Entrar com biometria · Termos e privacidade |

- **Meus dados**: a modal lista só os campos permitidos para o perfil.
  - Cada item abre o formulário existente, com Salvar e Cancelar; Cancelar volta à lista.
  - Os endpoints são os mesmos de antes: `/api/minha-conta`, `/api/minha-conta/email`, `/api/minha-conta/perfil-livre` e `/api/tenancy/meu-tenant`.
  - Em caso de erro, os valores digitados ficam.
- **Minha assinatura**: mostra o plano e o prazo reais, por exemplo "Teste grátis · 26 dias restantes", "Plano · ativa", cancelada ou pagamento pendente.

## Biometria

- O interruptor tem `role="switch"`, com `aria-checked` e o estado em texto: "Ativada neste aparelho", "Desativada neste aparelho" ou "Indisponível neste aparelho".
- **Estado real deste aparelho**: o id da passkey criada aqui fica em `localStorage` (`fitos:passkey-aparelho`, apenas o id público).
  - O controle aparece ativado só se esse id ainda existir na conta.
  - Contas que ativaram a biometria antes deste controle continuam valendo pelo marcador do "Continuar como".
- **Ativar**: `addPasskey` com `authenticatorAttachment: "platform"`.
- **Desativar**: remove só a passkey deste aparelho. As contas antigas, sem id guardado, perdem todas as passkeys, como antes.
- O interruptor só muda depois da confirmação. Erro ou cancelamento mantém o estado anterior e mostra o aviso.

## Arquivos

- `src/app/painel/perfil/ProfileParts.tsx`: cabeçalho, grupos, linhas, Meus dados e Termos.
- `src/app/painel/perfil/RoutineRows.tsx`: Dias de treino e Lembrete; substitui `_push/TrainingPreferences`.
- `src/app/painel/perfil/BiometricSwitch.tsx`: substitui `_push/PasskeyRow`.
- `src/app/painel/perfil/{Livre,Student,Personal}ProfileView.tsx`.
