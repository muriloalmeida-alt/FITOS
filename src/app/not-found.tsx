import type { Metadata } from "next";
import { appName } from "@/shared/config/env";
import { StatePanel } from "@/shared/ui/StatePanel";

export const metadata: Metadata = {
  title: `Página não encontrada — ${appName}`,
};

/// Página 404 (FIT-171, S1 "Não encontrado"). Estado informativo, sem
/// `role="alert"`: um link que não existe não é falha recuperável.
export default function NotFound() {
  return (
    <StatePanel
      fullscreen
      eyebrow="Não encontrado"
      title="Não encontramos isso."
      description="O item pode ter sido arquivado ou o link está errado."
      primary={{ label: "Voltar ao início", href: "/" }}
    />
  );
}
