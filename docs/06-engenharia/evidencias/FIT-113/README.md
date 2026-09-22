# Evidências — FIT-113 (Onboarding profissional do Personal)

Capturas reais (Playwright contra `npm run dev`, servidor local), fluxo completo: cadastro de personal → gate obrigatório → wizard de 3 passos → conclusão.

- [Passo 1 — Dados complementares](01-passo1-dados-complementares.png): celular (com máscara) e CREF opcional; validação de celular inválido verificada (log do script, não uma captura).
- [Passo 2 — Perfil profissional](02-passo2-perfil-profissional.png): faixa de alunos, nome do espaço/negócio pré-preenchido com o nome atual do tenant ("Espaço de Personal"), aceite dos termos com o texto honesto de pendência (mesmo da FIT-110).
- [Passo 3 — Revisão](03-passo3-revisao.png): resumo de tudo o que foi informado, com "← Voltar" disponível para corrigir qualquer etapa antes de concluir.
- [Redirecionamento pós-conclusão](04-redirect-cadastrar-primeiro-aluno.png): como o tenant recém-criado não tinha nenhum aluno, o "Concluir" levou direto a `/painel/alunos/novo` ("primeiro passo útil", seção 7 do pacote) — não ao painel genérico.
- [Passo 1, mobile](05-mobile-passo1.png).

## Gate obrigatório verificado

Confirmado via o mesmo script: um personal recém-cadastrado, ao ser redirecionado para `/painel` pelo próprio fluxo de cadastro, é imediatamente redirecionado de novo para `/onboarding-personal` — o `/painel` nunca chega a renderizar até o perfil profissional existir. Aplica-se a toda conta `PERSONAL`, inclusive as já existentes antes desta História (decisão confirmada com Murilo).
