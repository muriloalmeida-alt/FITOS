# Shell autenticado e navegação responsiva (FIT-012, estendido pela FIT-016)

Este documento detalha a implementação da FIT-012: a estrutura visual autenticada do FitOS (shell de personal e de aluno), apoiada na autorização por sessão da FIT-011 e aplicando os tokens M3 (`docs/03-design/M3-DESIGN-TOKENS.md`) e a arquitetura de informação (`docs/03-design/UX-ARCHITECTURE.md`). A seção "Experiência inicial real do aluno (FIT-016)", ao final, descreve como a FIT-016 preencheu o conteúdo real de `AlunoHome` e adicionou a página "Perfil" — sem alterar a decisão de shell descrita a seguir.

## Uma única rota, decidida no servidor

Não existem rotas separadas por papel (`/painel/personal`, `/painel/aluno`). `src/app/painel/page.tsx` é a única rota autenticada; ela chama `getServerSession()` (identidade) e `getAuthContext()` (FIT-011, autorização) e decide no servidor qual componente renderizar:

- sem sessão → `redirect("/entrar")`;
- `role === "PERSONAL"` → `PersonalHome` (busca o tenant real via `ctx.tenantId`);
- `role === "ALUNO"` com vínculo (`ctx.studentId` presente) → `AlunoHome` (busca o `Student` real, incluindo o `Tenant` e seu `owner`, para exibir personal/espaço reais — FIT-016);
- `role === "ALUNO"` sem `ctx.studentId` → a FIT-011/FIT-014 colapsam "nunca teve `Student`" e "`Student` inativado pelo personal" no mesmo formato de `AuthContext` (`tenantId: null, studentId: null`) — correto para autorização (nos dois casos não há acesso normal), mas insuficiente para a mensagem certa ao aluno. A FIT-016 resolve isso **nesta página**, não no `AuthContext` (que permanece com o mesmo contrato de segurança da FIT-011/FIT-014): uma consulta adicional e direta, `prisma.student.findUnique({ where: { userId: ctx.userId } })`, decide entre:
  - `Student` existe com `status === "INATIVO"` → `AlunoInativo` ("Sua conta foi inativada pelo seu personal...");
  - nenhum `Student` (ou nenhuma linha encontrada) → `AlunoSemVinculo` ("Sua conta ainda não está vinculada a um personal...").

  Nenhuma das duas telas usa `AppShell` — são estados mínimos de "sem permissão", sem destino de negócio a oferecer.

Isso satisfaz diretamente o critério de aceite "não é possível trocar de shell alterando a URL": como há uma única URL e o shell é sempre derivado do papel real da sessão no servidor, não existe parâmetro de URL, cookie ou header que o cliente possa manipular para ver o shell de outro papel — a superfície de ataque desse critério é zero, por construção, não por validação adicional. O mesmo vale para `/painel/perfil` (FIT-016): é protegida por `requireStudent()` (FIT-011), então um personal que altere a URL manualmente é redirecionado de volta a `/painel` (evidência: `personal-tentativa-perfil-aluno.png`).

## `AppShell` (`src/shared/ui/AppShell.tsx`)

Componente compartilhado, reutilizado pelos dois papéis. Não depende de `identity`/`tenancy` — recebe `navItems`, `activeKey`, `title`, `subtitle` e um slot `trailing` (onde `PersonalHome`/`AlunoHome` passam o `LogoutButton` já existente da FIT-009), mantendo o isolamento de camadas já estabelecido (UI compartilhada não conhece o provedor de autenticação).

### Nenhuma funcionalidade futura é simulada

Cada `AppShellNavItem` só recebe `href` quando o destino é real. Todo destino ainda não implementado (Treinos, Financeiro, Configurações para o personal; Treino, Progresso para o aluno) usa `comingSoon: true` e nunca recebe `href` — renderiza como texto desabilitado com o rótulo "Em breve", sem nenhum link, rota ou tela fictícia por trás. Isso é testado (`AppShell.test.tsx`): nenhum item `comingSoon` é encontrável como `role="link"`. ("Alunos", do personal, passou a real na FIT-013; "Perfil", do aluno, passou a real na FIT-016 — ver seção final.)

### Navegação responsiva

Duas camadas de navegação sempre presentes no DOM, alternadas por CSS (`@media (min-width: 840px)`, o mesmo breakpoint "expanded" do M3):

- **Compacta (< 840px)**: barra inferior fixa. Personal tem 5 destinos; seguindo `UX-ARCHITECTURE.md` ("Compact: Navigation bar + Mais"), os 4 primeiros ficam diretos e o 5º ("Configurações") fica agrupado sob um botão "Mais" que expande/recolhe (testado). Aluno tem exatamente 4 destinos — cabe sem agrupamento, conforme a mesma tabela ("Navigation bar de 4 destinos").
- **Média/expandida (≥ 840px)**: rail lateral vertical com todos os destinos visíveis.

**Simplificação deliberada**: `UX-ARCHITECTURE.md` distingue três faixas (compact/medium/expanded) com tratamentos ligeiramente diferentes (rail vs. drawer persistente). Esta História implementa apenas duas faixas (barra inferior vs. rail), já que o shell atual tem um único destino real por papel — não há conteúdo suficiente para justificar um terceiro tratamento visual (drawer persistente) nesta rodada. Registrado aqui como decisão explícita, não como lacuna.

### Tema claro/escuro

Nenhum código novo: o FitOS já resolve o tema via `@media (prefers-color-scheme: dark)` nos tokens (`src/shared/design-system/tokens.css`, desde a fundação do projeto) — `AppShell` usa exclusivamente as variáveis CSS semânticas (`--fitos-color-*`), então os dois temas funcionam automaticamente, sem lógica de shell dedicada. Validado nas evidências (capturas em `light`/`dark`).

## Acessibilidade

- Destinos reais são `<Link>` (focáveis, ativáveis por teclado/Enter, `aria-current="page"` quando ativos).
- Destinos "Em breve" usam `aria-disabled="true"` e nunca são navegáveis.
- O botão "Mais" é um `<button>` real com `aria-expanded`, operável por teclado.
- Área de toque mínima de 48×48 dp respeitada (`--fitos-space-12` = 48px em todos os itens de navegação e no botão "Mais").
- Foco visível herdado do estilo global (`:focus-visible`, `globals.css`, já existente).
- Contraste: cores usadas são exclusivamente os tokens M3 já validados para AA (nenhuma cor nova introduzida).

## Logout a partir do shell

`LogoutButton` (já existente desde a FIT-009) é passado como `trailing` para `AppShell` em `PersonalHome` e `AlunoHome`, e também presente (fora do `AppShell`) em `AlunoSemVinculo` — logout funciona nos três estados possíveis da rota autenticada.

## Estrutura de arquivos

- `src/shared/ui/AppShell.tsx` + `.module.css` — componente compartilhado.
- `src/app/painel/navigation.ts` — `PERSONAL_NAV_ITEMS`/`ALUNO_NAV_ITEMS`, a arquitetura de informação de nível superior de cada papel (fonte: `UX-ARCHITECTURE.md`).
- `src/app/painel/PersonalHome.tsx`, `AlunoHome.tsx`, `AlunoSemVinculo.tsx`, `AlunoInativo.tsx` (+ `.module.css`) — conteúdo por papel/estado.
- `src/app/painel/perfil/page.tsx` — página "Sua conta" do aluno (FIT-016).
- `src/app/painel/page.tsx` — decide qual dos quatro renderizar, a partir da sessão e do `AuthContext` (mais a consulta direta a `Student.status` descrita acima).

## O que a FIT-012 não fazia (histórico)

- Não implementava nenhuma funcionalidade de negócio (Alunos, Exercícios, Treinos, Financeiro) — os destinos correspondentes existiam apenas como rótulo "Em breve" (Alunos passou a real na FIT-013; Perfil do aluno, na FIT-016).
- Não implementa o drawer persistente separado da rail (ver "Simplificação deliberada" acima — ainda vale).
- Não adiciona nenhum toggle manual de tema — o tema já seguia o sistema operacional desde a fundação do projeto.
- Não altera nenhuma migration — nenhum schema novo foi necessário (também vale para a FIT-016).

## Testes

- `src/shared/ui/AppShell.test.tsx`: título e conteúdo renderizados; destino real navegável com `aria-current`; destino "Em breve" nunca é um link; agrupamento "Mais" (oculto por padrão, revela ao clicar); slot `trailing` renderizado.
- `src/app/painel/page.test.tsx`: redireciona para `/entrar` sem sessão; personal vê `PersonalHome` com o tenant real (sem chamar `student.findUniqueOrThrow`); aluno vinculado vê `AlunoHome` com personal/espaço reais (sem chamar `tenant.findUnique` nem `student.findUnique`); aluno nunca vinculado vê `AlunoSemVinculo`; aluno com vínculo inativado vê `AlunoInativo` — as duas últimas sem nenhum shell.
- `src/app/painel/perfil/page.test.tsx` (FIT-016): redireciona para `/entrar` sem sessão; redireciona para `/painel` quando `requireStudent()` rejeita (papel diferente de aluno com vínculo ativo — cobre diretamente o caso de um personal alterando a URL); aluno com vínculo ativo vê nome e e-mail da própria conta.

## Experiência inicial real do aluno (FIT-016)

A FIT-012 já decidia corretamente *qual* shell mostrar; a FIT-016 preencheu o conteúdo real do shell do aluno, sem alterar essa decisão:

- **`AlunoHome`** ganhou as props `displayName`, `tenantName`, `personalName` (todas vindas do `Student`/`Tenant`/`User` reais, buscados em `page.tsx`) e passou a exibir um card "Seu vínculo" (Personal, Espaço, Estado da conta) — a `email` foi removida das props: e-mail agora é responsabilidade exclusiva da nova página de conta.
- **`/painel/perfil`** (nova): página "Sua conta", protegida por `requireStudent()` — mostra nome e e-mail da própria sessão (`getServerSession()`), sem nenhum parâmetro de rota (o aluno é sempre o da própria sessão, nunca um id vindo do cliente). Acessível pelo item "Perfil" da navegação do aluno, que deixa de ser "Em breve".
- **`AlunoInativo`** (novo componente): mensagem distinta de `AlunoSemVinculo` para o caso "já teve acesso, mas o personal inativou o vínculo" (FIT-014) — ver a distinção completa na seção "Uma única rota, decidida no servidor" acima.
- Treino e Progresso continuam "Em breve" — esta História não promete treino, carga, evolução, avaliação, agenda ou mensagens.

Evidências visuais completas (mobile/desktop, claro/escuro, os quatro estados do aluno e a tentativa de um personal acessando `/painel/perfil`): `docs/06-engenharia/evidencias/FIT-016/`.
