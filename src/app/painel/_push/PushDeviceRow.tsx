"use client";

import { useState } from "react";
import { ActionRow, Button, useToast } from "@/shared/ui";
import { PUSH_HINT, usePush } from "./usePush";
import { InstallGuide, useInstallPrompt } from "./InstallGuide";

/// "Notificações neste aparelho" (EPIC-31): liga, desliga e testa.
export function PushDeviceRow({ purpose }: { purpose: string }) {
  const { state, enable, disable } = usePush();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [guide, setGuide] = useState(false);
  const installer = useInstallPrompt();

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
    } catch (cause) {
      toast.show(cause instanceof Error ? cause.message : "Não deu certo agora.");
    } finally {
      setBusy(false);
    }
  }

  const description = state === "on" ? `Ligadas. ${purpose}` : state === "off" || state === "loading" ? purpose : PUSH_HINT[state];
  const trailing =
    state === "on" ? (
      <span style={{ display: "flex", gap: 4 }}>
        <Button type="button" variant="quiet" disabled={busy} onClick={() => void run(async () => {
          const response = await fetch("/api/push/teste", { method: "POST" });
          if (!response.ok) throw new Error(((await response.json().catch(() => null)) as { message?: string } | null)?.message ?? "Não foi possível enviar.");
          toast.show("Teste enviado");
        })}>
          Testar
        </Button>
        <Button type="button" variant="quiet" disabled={busy} onClick={() => void run(disable)}>
          Desligar
        </Button>
      </span>
    ) : state === "off" ? (
      <Button type="button" variant="quiet" disabled={busy} onClick={() => void run(async () => {
        if (await enable()) toast.show("Notificações ligadas");
      })}>
        Ligar
      </Button>
    ) : state === "install" ? (
      <Button type="button" variant="quiet" onClick={() => setGuide(true)}>
        Como instalar
      </Button>
    ) : state === "unsupported" && installer.canInstall ? (
      <Button type="button" variant="quiet" onClick={() => void installer.install()}>
        Instalar app
      </Button>
    ) : null;

  return (
    <>
      <ActionRow title="Notificações neste aparelho" description={description} trailing={trailing} />
      <InstallGuide open={guide} onClose={() => setGuide(false)} />
    </>
  );
}
