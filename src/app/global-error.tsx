"use client";

import { useEffect } from "react";
import { reportClientError } from "@/shared/lib/reportClientError";

/// Erro no layout raiz: substitui a página inteira, então não usa o layout
/// nem os estilos do app. Registra nos logs do servidor (Railway).
export default function RootError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
    reportClientError("root", error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#0b0d10", color: "#fff", fontFamily: "system-ui, sans-serif" }}>
        <main role="alert" style={{ maxWidth: 360, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 24 }}>Não deu para carregar.</h1>
          <p style={{ color: "#a7adb7" }}>Tente de novo em instantes. Nada do que você já salvou foi perdido.</p>
          {error.digest ? <p style={{ color: "#6b7280", fontSize: 12 }}>Código: {error.digest}</p> : null}
          <button type="button" onClick={retry} style={{ marginTop: 12, minHeight: 48, padding: "0 24px", border: 0, borderRadius: 24, background: "#ff7847", color: "#111", fontWeight: 800 }}>
            Tentar de novo
          </button>
        </main>
      </body>
    </html>
  );
}
