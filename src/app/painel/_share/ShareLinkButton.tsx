"use client";

import { Button, useToast } from "@/shared/ui";

/// Compartilha um link do app (EPIC-47): menu nativo de compartilhar no
/// celular; senão, copia.
export function ShareLinkButton({ path, text, label = "Compartilhar" }: { path: string; text: string; label?: string }) {
  const toast = useToast();
  async function share() {
    const url = new URL(path, window.location.origin).toString();
    try {
      if (navigator.share) {
        await navigator.share({ text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${url}`);
      toast.show("Link copiado");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.show(url);
    }
  }
  return (
    <Button type="button" variant="quiet" onClick={() => void share()}>
      {label}
    </Button>
  );
}
