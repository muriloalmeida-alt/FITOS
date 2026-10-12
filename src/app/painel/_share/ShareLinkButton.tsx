"use client";

import { Button, useToast } from "@/shared/ui";

/// Compartilha um link do app (EPIC-47): menu nativo de compartilhar no
/// celular; senão, copia. O link vai dentro do texto (nunca no campo
/// `url`): WhatsApp e outros apps descartam o texto quando recebem `url`
/// separado, e o convite chegava só com o link.
export function ShareLinkButton({ path, text, label = "Compartilhar" }: { path: string; text: string; label?: string }) {
  const toast = useToast();
  async function share() {
    const url = new URL(path, window.location.origin).toString();
    const message = `${text}\n\n${url}`;
    try {
      if (navigator.share) {
        await navigator.share({ text: message });
        return;
      }
      await navigator.clipboard.writeText(message);
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
