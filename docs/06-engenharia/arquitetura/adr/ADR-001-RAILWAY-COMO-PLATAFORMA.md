# ADR-001 — Railway como plataforma

Status: Aceito
Decisor: Product Owner, Produto e Engenharia
Data: 15 de setembro de 2026

## Contexto

O MVP precisa hospedar aplicação Next.js e PostgreSQL com baixa carga operacional, ambientes isolados e integração com GitHub.

## Alternativas

- Railway;
- Vercel com banco externo;
- Supabase combinado a outro host;
- infraestrutura cloud montada manualmente.

## Decisão

Usar Railway para aplicação e PostgreSQL. GitHub Actions e o fluxo de PR controlam qualidade; produção só recebe versões provenientes de merge autorizado.

## Consequências

- operação inicial simplificada e stack concentrada;
- custos, limites, backups e comportamento de deploy devem ser validados;
- dependência da plataforma exige exportabilidade do banco, backups e rollback;
- arquivos permanecem em serviço S3 compatível a definir.
