# Runbook — diagnóstico de acesso à API Asaas em homologação (FIT-128)

**Concluído em 28/09/2026** — resultado já confirmado por Murilo a partir do log real de `fitos-web-hml`: `HTTP 200`, `497ms`, formato de listagem válido. O diagnóstico temporário descrito abaixo (`asaasSandboxDiagnostic.ts`/`instrumentation.ts`) foi removido do repositório depois de cumprir seu propósito — este documento fica só como registro histórico de como a verificação foi feita e do resultado obtido, nunca precisa ser executado de novo para a FIT-128. Ver `ADR-003-ASAAS-COMO-CANDIDATO.md` ("Atualização — conectividade/autenticação confirmadas...") e `src/modules/billing/asaasClient.ts` (cliente HTTP real que generaliza a mecânica provada aqui).

Documento autocontido para quem tem acesso direto ao Railway e à API do Asaas, mas não escreve no Git deste repositório. Nenhum passo aqui exige `git`/PR — é só ler logs (ou, no fallback manual, rodar um comando) e devolver o resultado saneado (sem chave, sem dado de cliente) para Murilo/Claude continuarem o trabalho de código.

## Contexto (resumo, sem precisar ler o repositório)

- Projeto: FitOS. Épico: EPIC-16 (#148). História bloqueada: FIT-128 — Integração real com Asaas (Issue #153).
- O ambiente de execução do Claude Code (onde o código é escrito) tem o egresso de rede bloqueado por política de proxy: `api.asaas.com`, `api-sandbox.asaas.com` e `api.mercadopago.com` retornam `403 connect_rejected` no `CONNECT` — confirmado duas vezes (FIT-091 em 21/09, FIT-128 em 28/09), documentado em `ADR-003-ASAAS-COMO-CANDIDATO.md` e `EPIC-16-MARCA-ENTRADA-E-MONETIZACAO-REAL.md`.
- **Ainda não existe nenhum adaptador real de integração com o Asaas neste repositório** — o que existe agora é só um **diagnóstico temporário** (`src/modules/billing/asaasSandboxDiagnostic.ts`, disparado uma única vez por `src/instrumentation.ts` na inicialização do servidor), que confirma conectividade/autenticação sem implementar nenhuma integração real. `src/modules/billing/subscriptions.ts` continua com `NO_PAYMENT_PROVIDER = "sem_integracao"`.
- A variável de ambiente já existente no Railway para isto é **`API_ASAAS`** (confirmado por Murilo) — o diagnóstico já lê exatamente esse nome, nenhuma variável nova precisa ser criada.

## Escopo autorizado (não ultrapassar)

- Só o environment de **homologação** do Railway (o que contém os serviços `fitos-web-hml`/`fitos-postgres-hml`) e a conta **Sandbox** do Asaas. O diagnóstico em código já se autorrestringe a isso: só roda quando `NEXT_PUBLIC_APP_ENV=homologacao` (confirmado em `AMBIENTES-E-DEPLOY.md` que é o valor real configurado em `fitos-web-hml`).
- Nunca produção, nunca chave de produção, nunca cobrança real, nunca dado de cliente real.
- Só uma chamada de leitura (`GET /v3/customers?limit=1`). Nada de criar cliente, assinatura ou cobrança ainda — isso é uma etapa futura separada, que só deve ser feita depois de descrever exatamente o que vai ser criado e confirmar que os identificadores são fictícios e restritos ao Sandbox.
- O diagnóstico nunca loga a chave, headers, corpo completo da resposta ou dado de cliente — só status HTTP, duração, e (em sucesso) se o formato da resposta é de listagem; em erro, só código/descrição saneados do próprio Asaas, ou uma categoria de falha de rede (timeout/DNS/TLS/conexão). Não é um endpoint público — só roda uma vez, na inicialização do processo.
- **Temporário**: depois que o resultado for confirmado, este diagnóstico (o arquivo `asaasSandboxDiagnostic.ts` e a chamada em `instrumentation.ts`) deve ser removido num PR próprio — não é o adaptador real, que só é escrito depois.

## Caminho principal — ler o log do próprio deploy (não precisa rodar nada)

Depois que o PR que adiciona este diagnóstico for mesclado e o Railway fizer o deploy em homologação (automático, ou disparado manualmente por você no painel):

1. Abra os logs do serviço `fitos-web-hml` no environment de homologação, no momento imediatamente após o deploy ficar `SUCCESS` (o diagnóstico roda uma única vez, logo na inicialização, antes mesmo do healthcheck responder).
2. Procure por uma linha começando com `[FIT-128][diagnostico-asaas]`. Ela já vem pronta para copiar — é exatamente o que precisa ser reportado, sem nenhuma edição:
   - `[FIT-128][diagnostico-asaas] sucesso: status=200 duracaoMs=<N> formatoDeListagem=true` — conectividade e autenticação confirmadas.
   - `[FIT-128][diagnostico-asaas] falha: status=<N> duracaoMs=<N> codigo=<...> descricao=<...>` — erro retornado pelo próprio Asaas (código/descrição já saneados pelo código, seguros para colar).
   - `[FIT-128][diagnostico-asaas] erro de rede: duracaoMs=<N> categoria=<...>` — falha de DNS/TLS/conexão/timeout antes de qualquer resposta HTTP.
   - `[FIT-128][diagnostico-asaas] pulado: variável API_ASAAS não configurada neste ambiente.` — a variável não está definida no serviço (confirme no painel do Railway, sem imprimir o valor).
3. Copie essa linha (ela já não contém a chave, headers ou dado de cliente) e devolva a Murilo/Claude — pule para a seção final deste documento.

## Caminho alternativo — verificação manual antes do deploy (opcional)

Se quiser confirmar a credencial/conectividade **antes** do PR ser mesclado, ou como checagem cruzada independente do código:

**Importante**: rode isto *dentro* da rede do Railway (via `railway run`, `railway ssh`, ou o shell do serviço no painel) — nunca da sua própria máquina/rede local, porque o que importa é se o **runtime de homologação** alcança o Asaas.

```bash
curl -sS -o /tmp/asaas-resp.json -w '\nHTTP_STATUS=%{http_code}\nTIME_TOTAL=%{time_total}\n' \
  --max-time 15 \
  -H "access_token: ${API_ASAAS}" \
  -H "User-Agent: FitOS/1.0" \
  "https://api-sandbox.asaas.com/v3/customers?limit=1"
```

Depois de rodar, capture **só isto** (nunca o conteúdo de `/tmp/asaas-resp.json` inteiro):

- O valor de `HTTP_STATUS` e `TIME_TOTAL` impressos pelo próprio `curl`.
- Se `HTTP_STATUS` for `200`: rode `head -c 200 /tmp/asaas-resp.json` só para confirmar que começa com `{"object":"list"` — não cole o conteúdo completo, só confirme "formato de listagem válido, sim/não".
- Se `HTTP_STATUS` for `4xx`/`5xx`: cole **só** `errors[0].code`/`errors[0].description` do JSON de resposta — nunca o resto do payload.
- Se o `curl` falhar antes de qualquer `HTTP_STATUS`, cole a mensagem exata do próprio `curl` (nunca contém a chave).
- Apague/não persista `/tmp/asaas-resp.json` depois.

| Resultado | Causa provável |
|---|---|
| `HTTP_STATUS=200`, JSON de listagem válido | Conectividade e autenticação OK |
| `HTTP_STATUS=401` | Chave errada, chave de outro ambiente (produção em vez de sandbox), ou header errado |
| `HTTP_STATUS=403` | IP de saída do Railway não está na whitelist da conta Asaas, ou permissão da chave insuficiente — **não desabilite nenhum controle de segurança para contornar isso**, é um achado, não um obstáculo a remover |
| Erro de DNS/TLS/conexão/timeout | Bloqueio de rede também no Railway (improvável) ou instabilidade momentânea — rode de novo uma vez para descartar |

## O que devolver a Murilo/Claude ao final

- A linha de log completa (caminho principal) **ou** o resumo do teste manual (`HTTP_STATUS`, `TIME_TOTAL`, erro saneado se houver) — qualquer um dos dois já é suficiente.
- Confirmação explícita de que nada foi tocado em produção, nenhuma chave de produção foi usada, e nenhum cliente/assinatura/cobrança foi criado.

Com isso, o Claude implementa o adaptador real (nome definitivo a decidir, ex. `src/modules/billing/asaas.ts`) já sabendo que a conectividade/autenticação está confirmada (ou já sabendo exatamente qual erro precisa ser resolvido antes), remove o diagnóstico temporário, e abre o PR normal do projeto (branch → testes → CI verde → review → merge) — a parte que exige Git continua sendo feita aqui, não pelo GPT.
