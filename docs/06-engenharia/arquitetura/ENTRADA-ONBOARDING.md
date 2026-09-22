# Entrada do onboarding com os três caminhos explícitos (FIT-112, EPIC-14)

## Objetivo e escopo

Seção 6 do pacote pede uma "primeira decisão" na entrada do onboarding, com requisitos comuns (indicador de progresso, voltar, confirmação ao fechar com dados preenchidos, navegação por teclado, foco controlado, erros próximos aos campos, validação client+server, proteção contra submissão duplicada, feedback de carregamento). O texto do pacote descreve só dois caminhos (Personal/Aluno); a decomposição da própria EPIC-14 (`docs/04-backlog/EPIC-14-LANDING-COMERCIAL-E-ONBOARDING.md`) já reframe isso para os três caminhos reais do produto (Personal / Aluno com convite / FitOS Livre), os mesmos que a landing (FIT-110) já anuncia — esta História implementa essa versão de três caminhos, não a de dois do texto literal do pacote, porque é a que corresponde à arquitetura real (FitOS Livre é uma jornada própria, nunca uma sub-opção de "Aluno").

**Achado real que motivou esta História**: `/criar-conta` sem `?modo=` já existia (FIT-101), mas nunca perguntava nada — assumia `mode: "personal"` silenciosamente e só oferecia um link discreto no rodapé para quem quisesse o FitOS Livre. Um visitante que chegasse ali por um link genérico (ex.: o CTA "Criar conta grátis" do cabeçalho da landing, que nunca leva `?modo=`) caía direto no formulário de personal sem nunca ter escolhido isso.

## Fluxo

Duas etapas reais, sempre por navegação de servidor (nunca estado só de cliente) — a URL é a própria fonte de verdade do passo atual, exigência explícita do pacote ("a URL deve continuar navegável, permitir retorno seguro"):

- **Etapa 1** (`/criar-conta`, sem `modo` ou com um `modo` não reconhecido): `OnboardingEntry` — três cartões.
  - **Sou Personal** → `?modo=personal` (etapa 2).
  - **Tenho convite do meu personal** → `ConviteCodeForm` (o mesmo componente da landing, FIT-110) — nunca chega à etapa 2 deste fluxo; sai direto para `/ativar-conta?token=...`, a validação já existente da FIT-015. Um aluno convidado nunca passa pelo formulário de criação de conta.
  - **FitOS Livre** → `/treino-sozinho` (o mesmo explicador que a landing já usa), cujo próprio CTA leva a `?modo=individual` — mantém uma única fonte da explicação do produto, em vez de duplicar o texto aqui.
- **Etapa 2** (`?modo=personal` ou `?modo=individual`): o formulário de cadastro já existente (FIT-009/101), agora com "Passo 2 de 2" e um botão "← Voltar" explícito.

## Decisões

- **Nenhum valor de `modo` cai num formulário por engano.** Qualquer valor diferente de `"personal"`/`"individual"` (incluindo ausente) volta para a etapa 1 — antes, um erro de digitação na URL ainda caía silenciosamente no formulário de personal.
- **CTAs com contexto já explícito pulam a etapa 1.** A landing já pergunta a mesma coisa visualmente (FIT-110) — o cartão "Sou Personal" da landing agora linka direto para `?modo=personal` (antes ia para `/criar-conta` bare, repetindo a mesma decisão uma segunda vez). CTAs sem contexto (o "Criar conta grátis" genérico do cabeçalho, o link do rodapé, o CTA final da landing) continuam levando à etapa 1 — é exatamente o cenário "entrada fria" que a seção 6 do pacote descreve.
- **"Voltar" com confirmação é navegação de cliente interceptada, não `beforeunload`.** `beforeunload` só dispara num descarregamento real de página (fechar aba, recarregar, navegar para fora do site) — nunca para o `router.push` do Next.js entre `/criar-conta?modo=personal` e `/criar-conta`. Por isso o botão "← Voltar" (agora dentro do próprio `CriarContaForm`, não mais um `<Link>` do Server Component) confirma com `window.confirm` quando algum campo tem conteúdo, antes de navegar — implementação explícita, não incidental, do requisito "opção de fechar com confirmação se houver dados preenchidos" também para a navegação interna do próprio fluxo. `beforeunload` continua registrado para o outro caso real (fechar a aba/navegar para fora) enquanto houver dado digitado e a submissão não estiver em andamento.
- **Foco controlado**: cada etapa é uma navegação real de servidor (Server Component, não uma transição SPA) — o comportamento padrão do navegador (foco reiniciado no topo do documento a cada carregamento real de página) já satisfaz o requisito sem nenhum JavaScript adicional; não há nenhuma "troca de conteúdo sem navegação" aqui que exigiria gerência manual de foco.
- **Nenhum contrato novo**: `signUp.email`, `checkActivationToken`/`/ativar-conta`, `/treino-sozinho` — todos já existentes, só reorganizados por uma tela de decisão explícita na frente.

## Segurança e LGPD

Nenhuma mudança — a decisão em si não coleta nem deriva nenhum dado; cada caminho escolhido cai exatamente nas mesmas validações/autorizações já existentes (FIT-009/015/101).

## Critérios de aceite (seção 6 + 17 do pacote) resolvidos por esta História

- [x] Indicador de progresso ("Passo 1 de 2"/"Passo 2 de 2").
- [x] Botão Voltar (etapa 2 → etapa 1).
- [x] Confirmação ao "fechar" (navegar para fora) com dados preenchidos — tanto internamente (`window.confirm` no Voltar) quanto externamente (`beforeunload`).
- [x] Navegação por teclado e foco controlado (navegação real de servidor + elementos nativamente focáveis).
- [x] Mensagens de erro próximas aos campos, validação client+server, proteção contra submissão duplicada, feedback durante chamadas à API — já existentes em `CriarContaForm`, preservados sem alteração de comportamento.
- [x] URL navegável e retorno seguro (cada etapa é uma URL real, nunca estado perdido ao recarregar).

## Testes executados

- `src/app/criar-conta/OnboardingEntry.test.tsx` (2 testes): os três caminhos com rotas reais, textos da seção 6.
- `src/app/criar-conta/page.test.tsx` (4 testes, novo): sem `modo` → etapa 1; `modo` não reconhecido → etapa 1; `modo=personal`/`modo=individual` → etapa 2.
- `src/app/criar-conta/CriarContaForm.test.tsx` (+3 testes): Voltar sem dados navega direto; Voltar com dados pede confirmação (cancelar não navega, aceitar navega).
- `src/app/page.test.tsx` (+1 teste): CTA "Sou Personal" da landing já aponta para `?modo=personal`.
- Suíte completa: 904/904. `tsc --noEmit`/`eslint .`/`npm run build` limpos.

## Evidências

`docs/06-engenharia/evidencias/FIT-112/README.md` — capturas reais (desktop e mobile) das duas etapas e do fluxo de confirmação do "Voltar".

## Pendências reais

Nenhuma nova. Os wizards completos de onboarding (Personal/Aluno/FitOS Livre) continuam sendo a FIT-113/114/115.
