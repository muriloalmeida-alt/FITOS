# Evidências — FIT-139 (EPIC-18, ajustes da tela de login)

Capturas reais com Playwright (Chromium) contra `next dev` local e PostgreSQL 16 local. O estado de erro foi obtido enviando o formulário de verdade com credenciais inexistentes (`/api/auth/sign-in/email` respondeu erro e a tela mostrou o aviso). Nenhum dado de produção. Sem área segura real (browser desktop): `env(safe-area-inset-*)` precisa ser conferido em iPhone/Android reais na homologação.

| Arquivo | Conteúdo |
| --- | --- |
| `01-mobile-390-vs-proposta.jpg` | 390 × 844: proposta (padrão) × implementação, proposta (erro) × implementação. |
| `02-larguras-320-360-768.jpg` | 320 × 568 (rola 28 px, botão visível na primeira dobra), 360 × 640 com erro, 768 × 1024. |
| `03-desktop-1440-padrao-erro.jpg` | 1440 × 900 nos estados padrão e erro: foto em tela cheia, formulário na região escurecida, sem split 50/50. |

Medições automáticas (`getBoundingClientRect`/`scrollWidth`):

| Viewport | Overflow horizontal | Fim do botão "Entrar" | Altura rolável |
| --- | --- | --- | --- |
| 390 × 844 | não | 728 px | 844 (sem rolagem) |
| 390 × 844, erro | não | 728 px (sem salto) | 844 |
| 320 × 568 | não | 488 px | 596 |
| 360 × 640, erro | não | 532 px | 640 |
| 768 × 1024 | não | 908 px | 1024 |
| 1440 × 900 (padrão/erro) | não | 656/657 px | 900 |
