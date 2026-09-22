# Decisões pendentes

| Decisão | Responsável | Momento limite | Impacto se adiada |
|---|---|---|---|
| Resultado da prova Better Auth | Engenharia + Produto | antes da autenticação produtiva | bloqueia identidade |
| Resultado da prova Asaas | Engenharia + Produto | antes da cobrança SaaS | bloqueia monetização |
| Planos, preços e teste grátis | Product Owner + Produto | antes do checkout | bloqueia oferta comercial |
| Carência, suspensão e reativação | Product Owner + Produto | antes do controle de acesso pago | risco de bloqueio incorreto |
| Limites por plano | Produto | antes da comercialização | impede enforcement coerente |
| Provedor S3 compatível | Engenharia | antes de fotos/anexos | bloqueia arquivos — bloqueou explicitamente "fotos privadas" da FIT-104 (`ADR-008-EVOLUCAO-DO-PRATICANTE-INDIVIDUAL.md`); resto da História implementado, essa parte deferida até esta decisão |
| E-mail transacional | Engenharia + Produto | antes de convite/recuperação | bloqueia jornadas de acesso — bloqueou explicitamente a "comunicação" da FIT-106 (`ADR-009-ENCERRAMENTO-DE-VINCULO.md`); resto da História (encerrar o vínculo, data, motivo) implementado, essa parte deferida até esta decisão |
| Modelagem de `Student` por-pessoa vs. por-tenant (`userId` globalmente único) | Engenharia + Produto | antes da FIT-109 | impede um aluno ter vínculo com mais de um personal ao longo do tempo (sinalizado por `ADR-009-ENCERRAMENTO-DE-VINCULO.md`) |
| Backup, retenção e restauração | Engenharia | antes de dados reais | risco operacional |
| Domínios e URLs | Product Owner + Engenharia | antes da homologação pública | configuração incompleta |
| Retenção e exclusão LGPD | Produto + responsável jurídico | antes da produção | risco legal |
| Termos comerciais da API Ninjas | Product Owner + Engenharia | antes do uso comercial | bloqueia catálogo externo |

Nenhuma pendência autoriza escolha silenciosa. A decisão deve ser registrada em Issue/PR e ADR quando arquitetural.
