# Landing comercial (FIT-110, EPIC-14)

## Objetivo e escopo

Substituir a landing placeholder da fundação técnica (`src/app/page.tsx`, FIT-006) por uma página pública comercial real: cabeçalho com navegação e CTAs, hero, três pilares de benefícios, os três caminhos do produto (Personal / Aluno com convite / FitOS Livre) e a seção de relação Personal-Aluno, CTA final e rodapé — seções 5 e 8A do pacote `PROMPT_CLAUDE_LANDING_ONBOARDING_FITOS.md` (EPIC-14, `docs/04-backlog/EPIC-14-LANDING-COMERCIAL-E-ONBOARDING.md`).

**Fora do escopo desta História** (deliberadamente, para não duplicar trabalho): a seção 8B do pacote pede também um teaser da biblioteca ilustrada de exercícios na própria landing ("quase 100 exercícios ilustrados") — adiado para a FIT-111, que estabelece o caminho de armazenamento real das imagens de exercício; construir esse teaser agora exigiria inventar um caminho temporário que a FIT-111 substituiria depois. Os wizards completos de onboarding (etapas do Personal, do Aluno, do FitOS Livre) são as FIT-112 a FIT-115 — esta História entrega só a landing e o ponto de entrada dos três caminhos.

## Fluxo

Página pública, sem verificação de sessão (Server Component puro, sem `redirect`/`getServerSession`) — a mesma landing é servida a qualquer visitante, autenticado ou não. Único estado interativo é o menu mobile (`LandingHeader`, Client Component isolado).

Três caminhos, cada um levando a uma rota já real (nenhum contrato novo):

- **Sou Personal** → `/criar-conta` (`?modo` ausente = personal, já existente desde a FIT-101).
- **Treino com Personal** → explica que o acesso depende de convite do personal; campo "Já tem um código de convite?" (`ConviteCodeForm`, novo) navega para `/ativar-conta?token=<código>` — reaproveita a validação já existente (`checkActivationToken`, FIT-015) sem nenhuma rota ou contrato novo.
- **FitOS Livre** → `/treino-sozinho` (já existente desde a FIT-101).

## Decisões de UX

- **Paleta "chrome" (navy/lima) redefinida localmente, nunca um Design System novo.** Toda a página herda os tokens `--fitos-color-chrome*` (mesma paleta do `AppShell` autenticado) redefinindo localmente `--fitos-color-surface(-container)`/`-on-surface(-variant)`/`-outline`/`-primary`/`-on-primary` — mesmo padrão de sobreposição local já usado em `AppShell.module.css` (`.trailing`). O fundo escuro é constante mesmo com preferência de sistema clara (os tokens chrome nunca alternam com o tema), exatamente o efeito pedido pela seção 4.2 do pacote.
- **Referência visual navegável do pacote inacessível nesta sandbox** (proxy de saída bloqueia `fitos-em-movimento.hmqsgqtv8q.chatgpt.site`) — direção seguida a partir do texto da seção 4 do pacote e dos tokens M3 já existentes, não da referência em si. Registrado como limitação real, não suposição silenciosa.
- **Duas imagens reais do pacote, otimizadas.** "Treino premium com personal trainer.png" (hero principal — personal acompanhando aluno durante um lunge com halteres) e "Treinador e aluno revisam o treino no celular.png" (seção Personal-aluno) — as duas batem exatamente com os requisitos da seção 4.3 ("imagem de personal acompanhando aluno durante exercício" e "personal e aluno avaliando resultados pelo celular"). Convertidas de PNG (~1,8 MB cada) para WebP (~40-65 KB cada, redimensionadas para no máximo 900px de largura) — `public/media/landing/`, mesmo padrão de nomenclatura de `public/media/brand/`. `next/image` com `width`/`height` explícitos evita layout shift; a imagem secundária usa `loading="lazy"` (fora da primeira dobra), a principal usa `priority` (é o próprio hero).
- **Rodapé sem link morto.** Não existe nenhuma página de Termos/Política de Privacidade no repositório — em vez de um link falso, o rodapé mostra o texto "Termos de uso e Política de Privacidade — em preparação", conforme a seção 5.5 do pacote exige explicitamente ("Não criar links mortos... deixar a pendência documentada").
- **Campo de convite com `autoComplete="off"`** — sem isso, o Chrome aplica sua própria heurística de autofill de "código" (o nome do campo e o rótulo mencionam "código") e injeta `caret-color` no input depois da hidratação, que o React reporta como divergência servidor/cliente. Nenhum bug de dado — só ruído de console em desenvolvimento — mas corrigido porque o campo genuinamente não deve participar de autofill do navegador.

## Contratos utilizados (nenhum alterado)

- `checkActivationToken`/`/ativar-conta` (FIT-015) — reaproveitados sem alteração pelo `ConviteCodeForm`.
- `/criar-conta`, `/treino-sozinho`, `/entrar` (FIT-101/FIT-009) — apenas links, nenhuma alteração de contrato.

## Regras de tenant e convite

Nenhuma nova. A landing nunca lê nem deriva `tenantId` — é inteiramente pública e estática; o único dado que o visitante fornece (o código de convite) é só repassado como query string para `/ativar-conta`, que já faz toda a validação no servidor.

## Segurança e LGPD

Nenhum dado sensível coletado ou exibido nesta página. O campo de código de convite nunca valida nem consome o convite aqui — apenas navega para a página que já faz isso; nenhuma nova superfície de enumeração de contas/convites foi criada.

## Analytics

Nenhuma plataforma de analytics existe hoje no projeto — conforme a seção 13 do pacote ("Não introduzir nova plataforma de analytics somente para esta entrega"), nenhum evento foi instrumentado nesta História.

## Critérios de aceite (seção 17 do pacote) resolvidos por esta História

- [x] A landing está integrada ao FitOS real (CTAs e "Entrar" usam as rotas reais).
- [x] Visual aderente ao M3 já existente.
- [x] Imagens locais e otimizadas, sem layout shift.
- [x] Nenhum link morto — pendência de Termos/Privacidade documentada como texto, não como rota falsa.
- [x] Desktop e mobile adequados.
- [x] Acessibilidade básica verificada (ver Testes).

## Testes executados

- `src/app/page.test.tsx` (7 testes): cabeçalho, hero com o texto exato do pacote, três pilares, três caminhos com links reais, seção Personal-aluno + CTA final, nenhum link morto de página legal, alt text funcional em toda imagem.
- `src/app/LandingHeader.test.tsx` (3 testes): navegação desktop, menu mobile fechado por padrão e alternando corretamente, fechamento ao navegar.
- `src/app/ConviteCodeForm.test.tsx` (3 testes): rejeita envio vazio sem navegar, navega para `/ativar-conta?token=...` com o código informado (codificado), ignora espaços nas pontas.
- Suíte completa: 876/876. `tsc --noEmit`/`eslint .`/`npm run build` limpos.

## Evidências

`docs/06-engenharia/evidencias/FIT-110/README.md` — capturas reais (desktop e mobile) do servidor de desenvolvimento local, incluindo o menu mobile aberto.

## Pendências reais

- Teaser da biblioteca ilustrada na landing (seção 8B do pacote) — adiado para a FIT-111, que estabelece o caminho de armazenamento das imagens de exercício.
- `/favicon.ico` retorna 404 em toda a aplicação (achado durante a verificação desta História, não uma regressão dela) — sem História própria ainda.
- Analytics (seção 13 do pacote) — nenhuma plataforma existe; instrumentação fica pendente de uma decisão de produto sobre qual plataforma adotar.
