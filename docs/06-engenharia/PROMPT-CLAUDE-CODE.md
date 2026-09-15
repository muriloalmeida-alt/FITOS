# Prompt para Claude Code — Planejamento Técnico do FitOS

Você é responsável pela Engenharia do FitOS. Murilo Almeida atua como Product Owner/Sponsor e o GPT do Murilo atua como Product Manager e Product Designer.

Leia integralmente, antes de propor ou alterar código:

- `docs/README.md`
- `docs/01-produto/PRD-01-MVP.md`
- `docs/01-produto/REGRAS-DE-NEGOCIO.md`
- `docs/01-produto/MODELO-DE-DADOS.md`
- `docs/02-integracoes/INTEGRACAO-API-NINJAS.md`
- `docs/04-backlog/BACKLOG-MVP.md`
- `docs/03-design/PRODUCT-DESIGN.md`

## Objetivo desta etapa

Não implemente todo o MVP de uma vez. Primeiro faça uma análise do repositório e transforme a documentação de produto em um plano técnico incremental.

## Entregáveis obrigatórios

1. Diagnóstico do estado atual do repositório, incluindo arquitetura, dependências, autenticação, banco, deploy e lacunas.
2. Proposta técnica para o MVP, preservando padrões já adotados quando forem adequados.
3. Mapeamento das entidades conceituais para o modelo de dados.
4. Estratégia de isolamento entre contas de personal trainers.
5. Estratégia de versionamento de planos atribuídos e histórico de sessões.
6. Estratégia de integração REST com API Ninjas exclusivamente pelo backend.
7. Plano de implementação dividido em issues pequenas, ordenadas e testáveis.
8. Lista explícita de dúvidas ou conflitos encontrados nos documentos.

## Restrições

- Não inclua nenhuma chave real da API Ninjas.
- Use variável de ambiente com nome semântico e documente-a em `.env.example` apenas com placeholder.
- Não faça chamadas da API Ninjas diretamente pelo frontend.
- O MCP `https://mcp.api-ninjas.com/mcp/health` é ferramenta de desenvolvimento, não integração de produção.
- Não gere treinos automaticamente a partir da API: ela fornece exercícios; a prescrição pertence ao FitOS e ao personal.
- Não permita acesso cruzado entre contas.
- Não altere histórico atribuído ou executado quando modelos forem modificados.
- Não implemente itens fora do MVP sem decisão de Produto.

## Formato da resposta

- Resumo executivo.
- Estado atual.
- Arquitetura proposta.
- Modelo de dados proposto.
- Segurança e privacidade.
- Integração API Ninjas.
- Issues recomendadas em ordem.
- Riscos, dependências e perguntas para Produto.

Ao encontrar ambiguidade de produto, não decida silenciosamente. Registre a pergunta para refinamento com o Product Manager.
