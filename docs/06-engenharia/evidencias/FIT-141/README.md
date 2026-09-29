# Evidências — FIT-141 (tela de abertura)

Referência enviada por Murilo em 29/09/2026: `referencia-splash.png`.

Capturas com Playwright (Chromium) contra `next dev` local e PostgreSQL local. Os quadros foram congelados em tempos exatos da animação (Web Animations API) com a troca de rota suspensa só durante a captura.

| Arquivo | Conteúdo |
| --- | --- |
| `01-mobile-quadros-vs-referencia.jpg` | 390 × 844: referência × quadros em 0,4 s, 0,8 s, 1,3 s (último quadro antes da saída) e 2,6 s (se o destino demorar, o brilho segue correndo nas curvas). |
| `02-desktop-1440.jpg` | 1440 × 900 em 1,3 s. |

Fluxo real verificado no navegador:

- Sem sessão: `/` → abertura → `/entrar` (~2,3 s em `next dev`, incluindo compilação sob demanda). "Voltar" não retorna à abertura (`router.replace`).
- Com sessão (conta criada por `/api/auth/sign-up/email`): `/` → abertura → `/painel`.
