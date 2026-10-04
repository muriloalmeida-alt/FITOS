"use client";

import { useEffect } from "react";
import { StatePanel } from "@/shared/ui/StatePanel";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  /// Next.js 16.3: `retry` busca de novo e re-renderiza o segmento.
  retry: () => void;
}

/// Estado de erro do segmento `app/` (FIT-171, S1 "Erro de conexão"). Nunca
/// expõe `error.message`/stack ao usuário — só registra no console para
/// diagnóstico. Diz que nada foi perdido e oferece "Tentar de novo".
export default function GlobalError({ error, retry }: GlobalErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatePanel
      fullscreen
      role="alert"
      tone="danger"
      eyebrow="Erro de conexão"
      title="Não deu para carregar."
      description="Verifique sua internet e tente de novo. Nada do que você já salvou foi perdido."
      primary={{ label: "Tentar de novo", onClick: retry }}
      secondary={{ label: "Ir para o início", href: "/painel" }}
    />
  );
}
