# Módulo: Tenancy

Responsabilidade: personal, vínculos e contexto do tenant (`docs/06-engenharia/arquitetura/MODELO-MULTITENANT.md`).

Regra inviólável para Histórias futuras: `tenant_id` é sempre derivado no servidor a partir da sessão autenticada, nunca aceito do cliente. Nenhuma implementação de tenancy física existe ainda — ver FIT-007.
