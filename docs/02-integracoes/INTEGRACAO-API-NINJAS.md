# FitOS — Integração com API Ninjas

> **Status: descontinuada (FIT-121, 27/09/2026).** A integração descrita
> abaixo foi implementada (FIT-020/FIT-021) mas nunca teve uma chamada real
> executada em nenhum ambiente — o catálogo global do FitOS foi
> integralmente preenchido pelo catálogo curado próprio (IMP-EX-002, 208
> exercícios em PT-BR), que não depende de nenhum fornecedor externo. O
> código (`src/integrations/api-ninjas/`, orquestração de carga, rota
> administrativa) foi removido pela FIT-121. Este documento é mantido como
> registro histórico da decisão original — ver
> `docs/06-engenharia/arquitetura/INTEGRACAO-API-NINJAS.md` e
> `docs/06-engenharia/arquitetura/adr/ADR-004-API-NINJAS-EXERCICIOS.md` para
> o detalhamento técnico e o encerramento.

## 1. Decisão

A API Ninjas será fonte externa para descoberta e importação de exercícios. Ela não será responsável por montar treinos, atribuir planos ou prescrever séries, repetições, cargas e descanso.

## 2. Interfaces

### Produção do FitOS

- Usar a Exercises API REST pelo backend.
- Endpoint-base documentado: `GET https://api.api-ninjas.com/v1/exercises`.
- Autenticação no servidor por `X-Api-Key`.
- Nunca realizar a chamada diretamente no navegador.

### Apoio ao desenvolvimento

- Claude Code pode usar o MCP de saúde: `https://mcp.api-ninjas.com/mcp/health`.
- O MCP auxilia exploração e validação, mas não substitui a integração REST da aplicação.
- A credencial deve ser configurada localmente e nunca incluída em prompts, commits ou arquivos versionados.

## 3. Dados esperados

- `name`
- `type`
- `muscle`
- `difficulty`
- `instructions`
- `equipments`
- `safety_info`

## 4. Normalização

- Gerar identificador interno do FitOS.
- Preservar valores originais recebidos e a data da importação.
- Mapear tipo, músculo, dificuldade e equipamentos para taxonomias internas.
- Permitir texto de exibição em português sem perder o conteúdo original.
- Evitar duplicidade por chave normalizada de origem, nome e atributos relevantes.

## 5. Fluxo de uso

1. Personal pesquisa na biblioteca.
2. FitOS consulta primeiro o catálogo local.
3. Quando necessário, o backend consulta a API Ninjas.
4. Resultados são apresentados para seleção.
5. O exercício escolhido é normalizado e salvo localmente.
6. O personal define a prescrição dentro do treino.

## 6. Resiliência

- Falha externa não deve impedir acesso a exercícios já importados.
- Exibir erro amigável e permitir nova tentativa.
- Controlar timeout e quantidade de chamadas.
- Não repetir consultas idênticas sem necessidade.
- Monitorar respostas sem gravar a chave nos logs.

## 7. Restrições comerciais

- Confirmar o plano contratado antes do uso comercial.
- O plano gratuito não deve ser presumido como autorizado para operação comercial.
- Limites de consulta, paginação e endpoints premium devem ser tratados como dependência do fornecedor.

## 8. Critérios de aceite

- A chave não aparece no frontend, repositório ou logs.
- O personal pesquisa usando ao menos nome, músculo, tipo, dificuldade e equipamento quando suportados.
- Um resultado selecionado pode ser usado em um treino.
- O treino adiciona parâmetros de prescrição que não dependem da API.
- Exercício importado continua disponível durante indisponibilidade externa.
- Personal pode cadastrar um exercício próprio quando a busca não atender.
