# Assinatura SaaS

## Separação obrigatória

| Fluxo | Responsável pelo pagamento | Processamento no MVP |
|---|---|---|
| Assinatura FitOS | Personal trainer | Sim, após provedor aprovado |
| Cobranças dos alunos | Aluno para o personal | Não; apenas controle manual |

Entidades, estados e webhooks da assinatura não podem alterar diretamente `StudentCharge`.

## Planos comerciais (FIT-090)

Catálogo de ofertas versionado — ver `PLANOS-COMERCIAIS.md` para o detalhe completo. `SaasSubscription` ainda não referencia `CommercialPlan` nesta história; a FK entra na FIT-092.

## Candidato

Asaas é candidato primário; Mercado Pago é fallback. A aprovação depende de prova em sandbox.

## Prova técnica obrigatória do Asaas

- criar cliente e assinatura com dados fictícios;
- ativar e consultar situação;
- receber e autenticar webhooks;
- garantir idempotência e tolerância a reenvio/desordem;
- validar renovação bem-sucedida;
- validar falha, inadimplência e recuperação;
- cancelar sem apagar histórico;
- reconciliar estado local com o provedor;
- validar cartão recorrente e meios locais realmente disponíveis à conta;
- confirmar operação, custos e compatibilidade com Railway.

## Estado de acesso

As regras de teste grátis, carência, suspensão e reativação ainda são decisão comercial pendente. Até sua definição, a arquitetura não deve inventar bloqueio automático.

## Critério de decisão

- aprovado: ADR-003 muda para `Aceito`;
- reprovado: prova equivalente com Mercado Pago;
- inconclusivo: cobrança produtiva bloqueada.

Chaves ficam somente em variáveis protegidas; payloads são minimizados e webhooks nunca são confiados sem validação.
