"use client";

import { useEffect, useId, useState } from "react";
import { FormAlert, useToast } from "@/shared/ui";
import { authClient } from "@/modules/identity/auth-client";
import { platformPasskeyAvailable, readRememberedAccount, rememberAccount } from "../../_entrada/rememberedAccount";
import { ProfileIcon } from "./ProfileParts";
import styles from "./ProfileParts.module.css";

/// Id da passkey criada NESTE aparelho (a lista do servidor mostra as de
/// todos os aparelhos). Só o id público, nunca segredo.
const DEVICE_KEY = "fitos:passkey-aparelho";

function readDeviceId(): string | null {
  try {
    return window.localStorage.getItem(DEVICE_KEY);
  } catch {
    return null;
  }
}

function writeDeviceId(id: string | null) {
  try {
    if (id) window.localStorage.setItem(DEVICE_KEY, id);
    else window.localStorage.removeItem(DEVICE_KEY);
  } catch {
    // Sem armazenamento: o estado volta a ser lido do servidor.
  }
}

function markRemembered(passkey: boolean) {
  const account = readRememberedAccount();
  if (account) rememberAccount({ ...account, passkey });
}

type State = "loading" | "unavailable" | "on" | "off";

async function listIds(): Promise<string[]> {
  const result = await authClient.passkey.listUserPasskeys();
  return Array.isArray(result?.data) ? result.data.map((passkey: { id: string }) => passkey.id) : [];
}

/// Estado real deste aparelho: a passkey registrada aqui ainda existe na
/// conta. Contas ativadas antes deste controle (sem id guardado) valem
/// pelo marcador do "Continuar como".
export async function readBiometricState(): Promise<{ state: State; legacy: boolean }> {
  if (!(await platformPasskeyAvailable())) return { state: "unavailable", legacy: false };
  const ids = await listIds().catch((): string[] => []);
  const deviceId = readDeviceId();
  if (deviceId) return { state: ids.includes(deviceId) ? "on" : "off", legacy: false };
  const legacy = readRememberedAccount()?.passkey === true && ids.length > 0;
  return { state: legacy ? "on" : "off", legacy };
}

/// "Entrar com biometria" (proposta 10): interruptor com estado exposto e
/// em texto, ligado ao fluxo de passkey existente (EPIC-33). Só muda de
/// posição depois que o servidor confirma; erro mantém o estado anterior.
export function BiometricSwitch() {
  const toast = useToast();
  const stateId = useId();
  const [state, setState] = useState<State>("loading");
  const [legacy, setLegacy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void readBiometricState().then((result) => {
      if (!active) return;
      setState(result.state);
      setLegacy(result.legacy);
    });
    return () => {
      active = false;
    };
  }, []);

  async function enable() {
    const result = await authClient.passkey.addPasskey({ name: "Este aparelho", authenticatorAttachment: "platform" }).catch(() => null);
    const created = result && !result.error && result.data && "id" in result.data ? (result.data as { id: string }).id : null;
    if (!created) throw new Error("Não foi possível ativar a biometria. Tente de novo.");
    writeDeviceId(created);
    markRemembered(true);
    setLegacy(false);
    toast.show("Biometria ativada neste aparelho");
  }

  async function disable() {
    const deviceId = readDeviceId();
    // Sem id guardado (ativada antes deste controle): remove todas, como antes.
    const ids = deviceId && !legacy ? [deviceId] : await listIds();
    for (const id of ids) {
      const result = await authClient.passkey.deletePasskey({ id }).catch(() => ({ error: { message: "falha" } }));
      if (result?.error) throw new Error("Não foi possível desativar a biometria. Tente de novo.");
    }
    writeDeviceId(null);
    markRemembered(false);
    setLegacy(false);
    toast.show("Biometria desativada neste aparelho");
  }

  async function toggle() {
    if (busy || state === "loading" || state === "unavailable") return;
    const previous = state;
    setBusy(true);
    setError(null);
    try {
      if (previous === "on") await disable();
      else await enable();
      setState(previous === "on" ? "off" : "on");
    } catch (cause) {
      setState(previous);
      setError(cause instanceof Error ? cause.message : "Não foi possível alterar a biometria.");
    } finally {
      setBusy(false);
    }
  }

  const label = state === "on" ? "Ativada neste aparelho" : state === "off" ? "Desativada neste aparelho" : state === "unavailable" ? "Indisponível neste aparelho" : "Verificando este aparelho…";
  return (
    <li>
      <button type="button" role="switch" aria-checked={state === "on"} aria-describedby={stateId} className={styles.switchRow} disabled={busy || state === "loading" || state === "unavailable"} onClick={() => void toggle()}>
        <ProfileIcon name="biometria" />
        <span className={styles.switchText}>
          <span className={styles.switchTitle}>Entrar com biometria</span>
          <span id={stateId} className={styles.switchState}>
            {busy ? "Aguardando o aparelho…" : label}
          </span>
        </span>
        <span className={state === "on" ? `${styles.track} ${styles.trackOn}` : styles.track} aria-hidden="true" />
      </button>
      {error ? <FormAlert>{error}</FormAlert> : null}
    </li>
  );
}
