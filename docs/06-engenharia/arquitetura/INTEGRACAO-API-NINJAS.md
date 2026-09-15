# Arquitetura da integração API Ninjas

Este documento complementa `docs/02-integracoes/INTEGRACAO-API-NINJAS.md`.

## Fluxo

1. frontend consulta a API interna do FitOS;
2. backend pesquisa primeiro o catálogo local;
3. adaptador consulta API Ninjas quando necessário;
4. resultado é normalizado e apresentado;
5. exercício selecionado recebe ID interno e é persistido;
6. treino referencia o ID interno, não depende da API externa em execução.

## Controles

- segredo exclusivamente no Railway/backend;
- timeout e retry limitado com backoff apenas para falhas transitórias;
- limite de chamadas e cache conforme contrato do provedor;
- logs sem chave e sem payload sensível;
- deduplicação por origem, identificador externo e chave normalizada;
- métricas de latência, erro, limite e cache;
- falha externa não impede acesso ao catálogo já importado;
- exercício próprio continua disponível.

## Gate comercial

Antes da produção, confirmar plano, licença comercial, limites, atribuição, retenção/cache e campos efetivamente retornados. Divergências exigem atualização documental por PR.

## Segurança da credencial

Qualquer chave compartilhada em conversa deve ser considerada exposta e rotacionada. O pacote e o repositório nunca devem conter o valor real.
