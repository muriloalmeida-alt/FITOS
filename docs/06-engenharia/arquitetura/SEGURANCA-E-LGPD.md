# Segurança e LGPD

## Dados e finalidade

O FitOS trata identidade, contato, treinos, evolução, fotos opcionais e informações financeiras. Coletar apenas o necessário para a finalidade informada e restringir dados especialmente sensíveis.

## Controles mínimos

- TLS em trânsito e criptografia do provedor em repouso;
- segredos em variáveis protegidas e rotação documentada;
- autorização server-side e testes entre tenants;
- princípio do menor privilégio para banco, deploy e integrações;
- validação de entrada e proteção contra abuso;
- trilha de auditoria para planos, avaliações, acessos e pagamentos manuais;
- logs sem observações clínicas, tokens ou dados financeiros completos;
- backups protegidos e restauração testada antes da produção;
- dependências verificadas e correções críticas priorizadas.

## Direitos e ciclo de vida

Políticas de consentimento, transparência, exportação, correção, retenção, anonimização e exclusão serão refinadas antes de usar dados reais. Exclusão solicitada deve considerar obrigações legais e preservação mínima de auditoria.

## Incidentes

Definir responsável, severidade, contenção, investigação, comunicação e registro. Nunca publicar evidências sensíveis em Issues ou PRs.

## Gate de produção

Produção com usuários reais exige política de privacidade, termos aplicáveis, canal de atendimento, matriz de retenção e avaliação de segurança concluídos em Histórias próprias.
