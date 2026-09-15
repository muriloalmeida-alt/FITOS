# Ambientes e deploy

## Plataforma

Railway hospeda aplicação e PostgreSQL. ADR-001 registra a decisão.

## Ambientes

| Ambiente | Uso | Dados |
|---|---|---|
| Desenvolvimento | trabalho local | sintéticos |
| Homologação | validação integrada | fictícios/anonimizados |
| Produção | usuários reais | reais e protegidos |

Cada ambiente possui banco, URLs, chaves e integrações separados. Credencial de produção não pode existir em desenvolvimento ou homologação.

## Pipeline proposto

1. branch por História;
2. lint, tipos, testes unitários e build;
3. PR e revisão obrigatória;
4. homologação controlada;
5. merge autorizado;
6. deploy de produção rastreável ao SHA;
7. smoke test e monitoramento;
8. rollback se critérios falharem.

Não há deploy direto de branch de desenvolvimento para produção. Migrations destrutivas exigem estratégia expand/contract, backup e plano de reversão.

## Pendências antes do provisionamento

- topologia exata dos serviços Railway;
- disponibilidade e retenção de backups;
- política de migrations;
- domínio e URLs;
- orçamento e alertas de consumo;
- processo de rollback e recuperação testado.
