# Runbook — diagnóstico de acesso à API Asaas em homologação (FIT-128)

Documento autocontido para quem tem acesso direto ao Railway e à API do Asaas, mas não escreve no Git deste repositório. Nenhum passo aqui exige `git`/PR — é só executar comandos e devolver o resultado saneado (sem chave, sem dado de cliente) para Murilo/Claude continuarem o trabalho de código.

## Contexto (resumo, sem precisar ler o repositório)

- Projeto: FitOS. Épico: EPIC-16 (#148). História bloqueada: FIT-128 — Integração real com Asaas (Issue #153).
- O ambiente de execução do Claude Code (onde o código é escrito) tem o egresso de rede bloqueado por política de proxy: `api.asaas.com`, `api-sandbox.asaas.com` e `api.mercadopago.com` retornam `403 connect_rejected` no `CONNECT` — confirmado duas vezes (FIT-091 em 21/09, FIT-128 em 28/09), documentado em `ADR-003-ASAAS-COMO-CANDIDATO.md` e `EPIC-16-MARCA-ENTRADA-E-MONETIZACAO-REAL.md`.
- **Hoje não existe nenhum código de integração com o Asaas neste repositório** — nenhum adaptador, nenhuma variável de ambiente documentada em `.env.example`, nenhuma chamada de rede real. `src/modules/billing/subscriptions.ts` só tem um comentário citando o Asaas como trabalho futuro (`NO_PAYMENT_PROVIDER = "sem_integracao"`).
- Objetivo deste runbook: descobrir, a partir de um ambiente que **de fato alcança a internet** (o runtime do Railway em homologação, onde você tem acesso), se a autenticação/conectividade com o Asaas Sandbox funciona. **Não é para implementar a integração** — é só o diagnóstico que faltava para o Claude poder implementar o adaptador de verdade depois, contra fatos confirmados em vez de suposição.

## Escopo autorizado (não ultrapassar)

- Só o environment de **homologação** do Railway (o que contém os serviços `fitos-web-hml`/`fitos-postgres-hml`) e a conta **Sandbox** do Asaas.
- Nunca produção, nunca chave de produção, nunca cobrança real, nunca dado de cliente real.
- Só uma chamada de leitura (`GET`) nesta rodada. Nada de criar cliente, assinatura ou cobrança ainda — isso é uma etapa futura separada, que só deve ser feita depois de descrever exatamente o que vai ser criado e confirmar que os identificadores são fictícios e restritos ao Sandbox.
- Nunca imprimir, logar, colar ou de qualquer forma expor o valor da chave (`access_token`) em nenhum lugar — nem parcialmente, nem mascarado de um jeito reconstituível.

## Passo 1 — Confirmar (ou criar) a credencial Sandbox

1. No painel do Asaas, confirme que existe uma conta **Sandbox** (não produção) e que você tem (ou pode gerar) uma **API Key** dela. A chave começa com `$` — não remova esse caractere, não adicione espaços/aspas ao copiar.
2. No Railway, abra o **environment de homologação** (o mesmo de `fitos-web-hml`) → aba de variáveis do serviço `fitos-web-hml`.
3. Verifique se já existe alguma variável relacionada ao Asaas (procure por nomes como `ASAAS_API_KEY`, `ASAAS_ACCESS_TOKEN`, `ASAAS_TOKEN` — qualquer variante). **Reporte só o nome da variável que encontrar, nunca o valor.**
4. Se não existir nenhuma, crie a variável **`ASAAS_API_KEY`** no serviço `fitos-web-hml` do environment de homologação, com o valor da chave Sandbox do passo 1. Use exatamente esse nome (`ASAAS_API_KEY`) — é o nome que o código vai esperar quando o adaptador for implementado.
5. Confirme (sem imprimir o valor) que a variável está associada ao environment de homologação, nunca ao de produção, se ambos existirem no mesmo projeto Railway.

## Passo 2 — Rodar o teste de leitura a partir do runtime do Railway

**Importante**: o teste precisa rodar *dentro* da rede do Railway (via `railway run`, `railway ssh`, ou o shell do serviço no painel) — nunca da sua própria máquina/rede local, porque o que importa é se o **runtime de homologação** alcança o Asaas, não se o seu computador alcança.

Comando exato (ajuste só a forma de invocar conforme sua ferramenta — CLI `railway run`, shell do painel, etc., mas mantenha o comando `curl` idêntico):

```bash
curl -sS -o /tmp/asaas-resp.json -w '\nHTTP_STATUS=%{http_code}\nTIME_TOTAL=%{time_total}\n' \
  --max-time 15 \
  -H "access_token: ${ASAAS_API_KEY}" \
  -H "User-Agent: FitOS/1.0" \
  "https://api-sandbox.asaas.com/v3/customers?limit=1"
```

Depois de rodar, capture **só isto** (nunca o conteúdo de `/tmp/asaas-resp.json` inteiro, que pode conter dados de cliente mesmo em sandbox):

- O valor de `HTTP_STATUS` e `TIME_TOTAL` impressos pelo próprio `curl`.
- Se `HTTP_STATUS` for `200`: rode `head -c 200 /tmp/asaas-resp.json` só para confirmar que é um JSON de listagem válido (ex.: começa com `{"object":"list"`) — não cole o conteúdo completo no relatório, só confirme "formato de listagem válido, sim/não".
- Se `HTTP_STATUS` for `4xx`/`5xx`: rode `cat /tmp/asaas-resp.json` e cole **só o campo de mensagem de erro do Asaas** (geralmente `errors[0].description` ou `errors[0].code` no JSON de resposta) — nunca o resto do payload.
- Se o `curl` falhar antes de qualquer `HTTP_STATUS` (erro de DNS, TLS, conexão ou timeout), cole a mensagem de erro do próprio `curl` (ex.: `curl: (6) Could not resolve host`, `curl: (28) Connection timed out`) — essa mensagem nunca contém a chave.
- Apague ou não persista `/tmp/asaas-resp.json` depois de reportar.

## Passo 3 — Classificar o resultado

| Resultado | Causa provável | O que reportar |
|---|---|---|
| `HTTP_STATUS=200`, JSON de listagem válido | Conectividade e autenticação OK | "Sucesso — 200, listagem válida, tempo Xs" |
| `HTTP_STATUS=401` | Chave errada, chave de outro ambiente (produção em vez de sandbox), ou header errado | Cole a mensagem de erro do Asaas (sem a chave) |
| `HTTP_STATUS=403` | IP de saída do Railway não está na whitelist da conta Asaas, ou permissão da chave insuficiente | Cole a mensagem de erro do Asaas; **não desabilite nenhum controle de segurança para contornar isso** — é um achado, não um obstáculo a remover |
| Erro de DNS/TLS/conexão/timeout antes de qualquer status HTTP | Bloqueio de rede também no Railway (improvável, mas possível) ou instabilidade momentânea | Cole a mensagem exata do `curl`; se quiser, rode de novo uma vez para descartar instabilidade pontual |

## O que devolver a Murilo/Claude ao final

Um resumo curto, em texto (não precisa ser markdown formatado), com:

1. Nome da variável do Asaas que já existia no Railway (se existia) ou confirmação de que você criou `ASAAS_API_KEY` agora.
2. `HTTP_STATUS` e `TIME_TOTAL` do teste.
3. Se não foi `200`: a mensagem de erro saneada (Asaas ou `curl`), conforme a tabela do Passo 3.
4. Confirmação explícita de que nada foi tocado em produção, nenhuma chave de produção foi usada, e nenhum cliente/assinatura/cobrança foi criado.

Com isso, o Claude implementa o adaptador real (`src/modules/billing/asaas.ts` ou nome equivalente) já sabendo que a variável se chama `ASAAS_API_KEY`, que a conectividade está confirmada (ou já sabendo exatamente qual erro precisa ser resolvido antes), e abre o PR normal do projeto (branch → testes → CI verde → review → merge) — a parte que exige Git continua sendo feita aqui, não pelo GPT.
