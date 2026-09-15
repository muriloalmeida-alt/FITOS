# Observabilidade

## Objetivos

Detectar falhas, investigar incidentes e acompanhar saúde sem expor dados pessoais.

## Sinais mínimos

- logs estruturados com timestamp, ambiente, nível, módulo, request/correlation ID;
- erros e traces no Sentry;
- métricas de latência, taxa de erro e disponibilidade;
- métricas de banco e integrações externas;
- auditoria separada de logs operacionais.

## Eventos críticos

- falha de autenticação anômala;
- tentativa de acesso entre tenants;
- erro ao atribuir ou versionar plano;
- falha na importação API Ninjas;
- webhook inválido, duplicado ou não conciliado;
- migration/deploy malsucedido.

## Privacidade

Não registrar senha, token, chave, observação clínica, foto, payload financeiro completo ou texto livre sensível. IDs devem ser suficientes para investigação autorizada.

Alertas, retenção, SLOs e plantão serão definidos antes de produção conforme capacidade operacional.
