# EPIC-02 — Fundação Técnica

## Resultado esperado

Estabelecer uma arquitetura segura, multi-tenant, observável e implantável no Railway, suficiente para orientar as Histórias funcionais do MVP sem antecipar implementação.

## História inicial

### FIT-005 — Definição da arquitetura da solução — Concluída (PR #12, merged)

Como time do FitOS, queremos registrar as decisões, limites, modelos e riscos da arquitetura, para implementar o MVP de modo consistente, seguro e evolutivo.

## Escopo

- visão arquitetural e limites dos módulos;
- tenancy, papéis e autorização;
- modelo conceitual de dados;
- assinatura SaaS separada do financeiro dos alunos;
- integração API Ninjas;
- Railway, ambientes, deploy e rollback;
- segurança, LGPD, observabilidade e testes;
- ADRs confirmados e candidatos sujeitos a prova.

## Fora do escopo

- implementação de código ou infraestrutura;
- execução das provas técnicas;
- escolha definitiva de Better Auth ou Asaas antes das provas;
- aplicativos nativos, IA, offline, agenda, mensagens e demais itens pós-MVP.

## Critérios de sucesso

- decisões confirmadas distinguem-se de propostas;
- nenhum fluxo permite acesso entre tenants;
- cobrança SaaS não se confunde com cobranças dos alunos;
- integrações externas possuem limites, segurança e fallback documentados;
- Histórias posteriores podem ser refinadas sem decisões arquiteturais críticas ocultas.

## Histórias posteriores propostas

- Prova técnica do Better Auth.
- Prova técnica do Asaas.
- Fundação do projeto Next.js.
- Provisionamento dos ambientes Railway.
- Modelagem física e migrations iniciais.
- Pipeline CI/CD.

Essas Histórias só recebem identificadores após priorização de Produto. O EPIC-02 permanece aberto (Issue #10) como container de acompanhamento até que essas Histórias sejam priorizadas e concluídas.
