# Integrações

Adaptadores internos para provedores externos: API Ninjas, provedor de assinatura (Asaas/Mercado Pago), autenticação (Better Auth/Clerk) e e-mail transacional.

## `api-ninjas/` (FIT-020)

Client server-side isolado para a Exercises API. Nenhum outro módulo do FitOS faz `fetch` direto para `api.api-ninjas.com` — quem precisar de exercícios externos importa este pacote. Detalhes em `docs/06-engenharia/arquitetura/CATALOGO-DE-EXERCICIOS.md` e na decisão registrada em `docs/06-engenharia/arquitetura/adr/ADR-004-API-NINJAS-EXERCICIOS.md`. Nenhuma chave real está configurada em nenhum ambiente controlado por esta rodada; qualquer chave eventualmente exposta em conversas anteriores permanece tratada como comprometida e não deve ser usada — rotação é obrigatória antes de qualquer uso futuro.

Demais adaptadores (assinatura, autenticação, e-mail transacional) continuam sem cliente real nesta Sprint.
