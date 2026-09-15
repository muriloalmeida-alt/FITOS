# Módulo: Financeiro do aluno

Responsabilidade: lançamentos e baixa manual das mensalidades do aluno.

Regra inviólável para Histórias futuras: `StudentCharge.status` é exatamente `pendente`, `pago`, `atrasado` ou `cancelado`. "A vencer" é apresentação calculada, nunca um estado armazenado. Este módulo permanece separado do módulo `saas-subscription` — nenhum webhook de assinatura deve mutar `StudentCharge` diretamente.

Limite estrutural apenas — sem implementação nesta Sprint.
