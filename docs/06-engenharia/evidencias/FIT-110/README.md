# Evidências — FIT-110 (Landing comercial)

Capturas reais (Playwright contra `npm run dev`, servidor local). Nenhum dado de sessão/autenticação envolvido — a landing é pública e nunca verifica sessão.

## Desktop (1400×1000)

- [Hero](01-desktop-hero.png): cabeçalho (Recursos/Para quem/Começar, Entrar, Criar conta grátis), eyebrow/título/descrição/CTAs exatos do pacote, imagem principal ("Treino premium com personal trainer" do pacote, personal acompanhando aluno durante lunge com halteres).
- [Benefícios e três caminhos](02-desktop-beneficios-caminhos.png): os três pilares (Alunos sob controle / Treinos que evoluem / Financeiro simples) e o início da seção "Comece pelo caminho certo para você" com os três cartões (Sou Personal / Treino com Personal, incluindo o campo de código de convite / FitOS Livre).
- [Personal-aluno e CTA final](03-desktop-personal-aluno-cta.png): lista de relação Personal/Aluno com a imagem secundária ("Treinador e aluno revisam o treino no celular" do pacote) e o CTA final "Pronto para colocar sua rotina em movimento?".
- [Rodapé](04-desktop-footer.png): marca, links reais (Entrar/Criar conta/FitOS Livre) e o texto honesto de pendência ("Termos de uso e Política de Privacidade — em preparação") — nenhum link morto.

## Mobile (390×844)

- [Hero](05-mobile-hero.png): imagem acima do texto, cabeçalho com botão de menu.
- [Menu mobile aberto](06-mobile-menu-aberto.png): todos os links de navegação + "Entrar" + CTA "Criar conta grátis", foco preso ao menu (fecha ao clicar em qualquer link).
- [Três caminhos](07-mobile-caminhos.png): cartões em coluna única, incluindo o formulário de código de convite.

## Achados registrados durante a verificação (não bugs de produto)

- **Aviso de hidratação (resolvido)**: o campo de código de convite (`name="conviteCode"`, rótulo mencionando "código") acionava a heurística de autofill de código do Chrome, que injeta `caret-color` no input depois da hidratação — React reportava isso como divergência servidor/cliente. Corrigido com `autoComplete="off"` explícito no campo; confirmado sem nenhum aviso após a correção.
- **`/favicon.ico` retorna 404 (pré-existente, fora do escopo)**: nenhuma página do FitOS tem favicon hoje — não é uma regressão desta História nem algo introduzido por ela. Registrado aqui apenas para rastreabilidade; correção pendente, sem História própria ainda.
