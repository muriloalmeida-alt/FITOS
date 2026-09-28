import { appEnv } from "@/shared/config/env";
import { runAsaasSandboxDiagnostic } from "@/modules/billing/asaasSandboxDiagnostic";

/// `register()` do Next.js — chamado uma única vez quando uma instância
/// do servidor é iniciada (estável desde a v15, sem flag experimental).
/// Nunca aguardamos a promise do diagnóstico aqui: ela pode levar até 15s
/// (timeout do próprio diagnóstico) e não deve atrasar o servidor ficar
/// pronto para receber requisições — o diagnóstico só loga, nunca bloqueia
/// nada. `NEXT_RUNTIME === "edge"` é ignorado porque o diagnóstico usa
/// `AbortController`/`fetch` do Node e só precisa rodar uma vez, não uma
/// vez por runtime.
///
/// Temporário (FIT-128/Issue #153) — remover esta chamada e
/// `src/modules/billing/asaasSandboxDiagnostic.ts` depois que o resultado
/// for confirmado (ver `docs/06-engenharia/RUNBOOK-DIAGNOSTICO-ASAAS-HOMOLOGACAO.md`).
export function register() {
  if (process.env.NEXT_RUNTIME === "edge") {
    return;
  }
  void runAsaasSandboxDiagnostic({
    appEnv,
    apiKey: process.env.API_ASAAS,
    fetchImpl: fetch,
  });
}
