"use client";

import { useEffect, useState } from "react";
import { ActionRow, Button, useToast } from "@/shared/ui";
import { authClient } from "@/modules/identity/auth-client";
import { platformPasskeyAvailable, readRememberedAccount, rememberAccount } from "../../_entrada/rememberedAccount";

/// "Entrar com digital ou Face ID" no Perfil (EPIC-33): liga neste
/// aparelho (passkey) ou desliga todos. A chave privada fica no aparelho;
/// o FitOS guarda só a pública.
export function PasskeyRow() {
  const toast = useToast();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);

  function refresh() {
    return authClient.passkey
      .listUserPasskeys()
      .then((result) => setCount(Array.isArray(result?.data) ? result.data.length : 0))
      .catch(() => setCount(0));
  }

  useEffect(() => {
    void platformPasskeyAvailable().then(setAvailable);
    void authClient.passkey
      .listUserPasskeys()
      .then((result) => setCount(Array.isArray(result?.data) ? result.data.length : 0))
      .catch(() => setCount(0));
  }, []);

  async function enable() {
    setBusy(true);
    const result = await authClient.passkey.addPasskey({ name: "Este aparelho" }).catch(() => ({ error: { message: "cancelado" } }));
    setBusy(false);
    if (result?.error) {
      toast.show("Não foi possível ativar agora.");
      return;
    }
    const account = readRememberedAccount();
    if (account) rememberAccount({ ...account, passkey: true });
    toast.show("Pronto: da próxima vez, entre com a digital");
    void refresh();
  }

  async function disable() {
    setBusy(true);
    const result = await authClient.passkey.listUserPasskeys().catch(() => null);
    for (const passkey of Array.isArray(result?.data) ? result.data : []) {
      await authClient.passkey.deletePasskey({ id: passkey.id }).catch(() => undefined);
    }
    const account = readRememberedAccount();
    if (account) rememberAccount({ ...account, passkey: false });
    setBusy(false);
    toast.show("Entrada por digital desligada");
    void refresh();
  }

  const description =
    count > 0
      ? `Ligado em ${count} ${count === 1 ? "aparelho" : "aparelhos"}.`
      : available === false
        ? "Este aparelho não tem digital, Face ID ou bloqueio de tela disponível."
        : "Entre sem digitar a senha.";
  return (
    <ActionRow
      title="Entrar com digital ou Face ID"
      description={description}
      trailing={
        <span style={{ display: "flex", gap: 4 }}>
          {available ? (
            <Button type="button" variant="quiet" disabled={busy} onClick={() => void enable()}>
              {count > 0 ? "Este aparelho" : "Ativar"}
            </Button>
          ) : null}
          {count > 0 ? (
            <Button type="button" variant="quiet" disabled={busy} onClick={() => void disable()}>
              Desligar
            </Button>
          ) : null}
        </span>
      }
    />
  );
}
