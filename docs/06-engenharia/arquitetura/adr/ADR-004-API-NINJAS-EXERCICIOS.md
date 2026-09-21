# ADR-004 — API Ninjas como fonte do catálogo global de exercícios

Status: **Aceito, com escopo comercial explicitamente pendente** (FIT-020, EPIC-05/SPRINT-06)
Data: 16 de setembro de 2026

## Contexto

O FitOS precisa de um catálogo inicial de exercícios para reduzir o trabalho manual do personal. `docs/02-integracoes/INTEGRACAO-API-NINJAS.md` já define a API Ninjas (Exercises API) como fonte externa de descoberta/importação — este ADR registra a decisão técnica concreta desta Sprint: o que foi de fato comprovado, o que permanece pendente, e os limites reais do plano/contrato.

## Fonte consultada

Documentação oficial: `https://api-ninjas.com/api/exercises`. O Produto informou tê-la consultado em 16/09/2026 e relatou os fatos abaixo. Esta História tentou reconsultá-la de forma independente antes de implementar (`WebFetch`), mas o acesso a `api-ninjas.com` está bloqueado pelo proxy de egresso de rede deste ambiente de execução (`EGRESS_BLOCKED`) — a reconsulta independente não foi possível nesta rodada; os fatos abaixo são os informados pelo Produto, tratados como a fonte vigente até que uma reconsulta direta seja possível.

## Fatos do contrato (conforme relatado pelo Produto, 16/09/2026)

- `GET /v1/exercises` retorna **até 5 resultados por chamada**.
- Aceita os parâmetros `name`, `type`, `muscle`, `difficulty` e `equipments`.
- Autenticação via header `X-Api-Key`.
- O parâmetro `offset` é recurso **premium**.
- `GET /v1/allexercises` exige plano **Business** ou superior, **ou** plano anual; retorna uma **lista de nomes por grupo muscular**, não objetos completos.
- **Uso comercial** da Exercises API exige **assinatura premium**.

## Alternativas

- API Ninjas (Exercises API) — escolhida como fonte primária, já referenciada no PRD/integrações do FitOS.
- Nenhuma alternativa avaliada nesta rodada (fora de escopo da FIT-020) — se a licença/plano da API Ninjas se mostrar inviável para o volume desejado, avaliar outra fonte (ex.: wger, ExerciseDB) é uma decisão de Produto futura, não coberta aqui.

## Classificação exata do que foi comprovado nesta Sprint

| Item | Estado |
|---|---|
| **Client implementado** | ✅ Sim — `src/integrations/api-ninjas/` (FIT-020): header `X-Api-Key` de variável de ambiente server-side, timeout, encoding de query, validação runtime da resposta, erros tipados. |
| **Contrato testado com fixture** | ✅ Sim — testes cobrindo resposta válida/vazia/inválida, campos ausentes, 401/403/429/5xx, timeout, payload malformado, ausência da variável de ambiente. Nenhum desses testes toca a rede real. |
| **Chamada real comprovada** | ❌ Não — nenhuma chamada real foi feita a `api.api-ninjas.com` em nenhuma etapa desta Sprint. Nenhuma chave nova foi fornecida por canal seguro; a chave mencionada em conversa anterior é tratada como exposta e nunca foi usada, recuperada, transcrita ou registrada. |
| **Uso comercial autorizado** | ❌ Não — não confirmado se a conta do FitOS possui (ou pretende contratar) o plano premium exigido para uso comercial. Nenhum plano foi contratado, nem upgrade feito, nem custo gerado nesta Sprint. |
| **Importação real do catálogo global** | ❌ Não — sem chamada real comprovada nem uso comercial autorizado, a FIT-021 implementa a estrutura de importação (normalização, deduplicação, idempotência) inteiramente testada com fixtures; o gatilho de importação real contra a API real permanece desativado e documentado como pendência. |

## Decisão

**Aceito como fonte técnica primária**, com o uso real (chamada de rede e importação em massa) **explicitamente condicionado** a: (1) uma chave de API nova, fornecida por canal seguro, nunca reutilizando a chave já exposta; e (2) confirmação do Produto sobre o plano/licença comercial adequado ao volume de exercícios que o FitOS pretende importar (a Exercises API não oferece paginação real fora do plano premium — 5 resultados por chamada, sem `offset`, tornam inviável importar milhares de itens no plano gratuito sem um número impraticável de chamadas, o que esta Sprint **não tenta contornar**, por instrução explícita do Produto).

Enquanto essas duas condições não forem satisfeitas, o FitOS opera com: exercícios próprios do personal (FIT-022, sempre funcional, sem depender de nenhum fornecedor externo) e um catálogo global vazio ou parcialmente populado apenas quando uma importação real for explicitamente autorizada e executada por alguém com a credencial/licença corretas.

## Consequências

- `API_NINJAS_API_KEY` (variável de ambiente server-side, nunca `NEXT_PUBLIC_`) documentada em `.env.example` sem valor real; a aplicação não falha ao iniciar sem ela — a ausência apenas mantém a importação real indisponível (diferente de `BETTER_AUTH_SECRET`, que é obrigatória desde a FIT-009).
- O comando administrativo de importação (FIT-021) verifica a presença da variável antes de qualquer tentativa de chamada real; sem ela, encerra com uma mensagem explícita, nunca com um erro genérico.
- Nenhum dado de homologação/produção foi preenchido com catálogo externo nesta Sprint.
- Uma reconsulta futura da documentação oficial (quando o acesso de rede permitir, ou por consulta manual do Produto) deve atualizar este ADR se qualquer fato do contrato tiver mudado — não presumir que os limites acima são permanentes.
- Se o Produto decidir, em uma Sprint futura, contratar o plano necessário e fornecer uma chave nova por canal seguro, a importação real pode ser habilitada sem nenhuma mudança de código — apenas configurando `API_NINJAS_API_KEY` e executando o comando administrativo manualmente.

## Atualização — IMP-EX-001 (pacote pós-MVP, 21/09/2026)

O comando administrativo (FIT-021) ganhou trava de execução única, retomada por checkpoint e manifesto versionado de consultas — ver `docs/06-engenharia/arquitetura/INTEGRACAO-API-NINJAS.md`. Esta atualização não muda a classificação de uso comercial acima (ainda não autorizado) nem afirma nenhuma chave real — mas corrige um fato de conectividade: `api.api-ninjas.com` (o endpoint da API, diferente de `api-ninjas.com`, a documentação, que permanece bloqueada pelo proxy de egresso deste ambiente) **é alcançável** a partir deste sandbox. Testado com uma chave inválida propositalmente (`--dry-run`, sem gravar nada): a API respondeu 403 real para as 10 consultas do manifesto, confirmando que o client (FIT-020) funciona ponta a ponta contra a rede real, não só contra fixtures. `API_NINJAS_API_KEY` continua sem valor real neste `.env` — assim que uma chave nova (nunca a já exposta) for configurada por canal seguro, o `--dry-run` real (e a carga completa) podem ser executados a partir deste mesmo ambiente, sem depender do Railway.
