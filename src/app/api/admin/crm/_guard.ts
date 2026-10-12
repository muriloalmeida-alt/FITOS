import { featureEnabled } from "@/shared/config/features";

/// O CRM cria cupons: só com a feature de cupons ligada.
export function crmOff(): Response | null {
  return featureEnabled("CUPONS") ? null : Response.json({ error: "NAO_ENCONTRADO", message: "Recurso indisponível." }, { status: 404 });
}
