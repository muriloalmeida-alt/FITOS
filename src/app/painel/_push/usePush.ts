"use client";

import { useCallback, useEffect, useState } from "react";

/// Estado do push neste aparelho (EPIC-31).
/// - `install`: iPhone/iPad fora da Tela de Início (o iOS só entrega push
///   para o app instalado);
/// - `unsupported`: navegador sem push;
/// - `unavailable`: servidor sem chaves VAPID;
/// - `denied`: a pessoa bloqueou as notificações nas configurações.
export type PushState = "loading" | "install" | "unsupported" | "unavailable" | "denied" | "off" | "on";

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

function isIosOutsideHomeScreen(): boolean {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

async function send(method: "POST" | "DELETE", body: unknown) {
  const response = await fetch("/api/push/inscricao", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error("Não foi possível salvar este aparelho.");
}

export function usePush() {
  const [state, setState] = useState<PushState>("loading");
  const [key, setKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!supported) {
        if (!cancelled) setState(typeof navigator !== "undefined" && isIosOutsideHomeScreen() ? "install" : "unsupported");
        return;
      }
      const publicKey = ((await fetch("/api/push/chave").then((r) => r.json()).catch(() => null)) as { publicKey: string | null } | null)?.publicKey ?? null;
      if (cancelled) return;
      setKey(publicKey);
      if (!publicKey) return setState("unavailable");
      if (Notification.permission === "denied") return setState("denied");
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = registration ? await registration.pushManager.getSubscription() : null;
      if (cancelled) return;
      if (subscription) {
        // Mantém o servidor em dia com este aparelho.
        void send("POST", { subscription: subscription.toJSON() }).catch(() => undefined);
        setState("on");
      } else {
        setState("off");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /// Pede a permissão e inscreve o aparelho. `true` se ficou ligado.
  const enable = useCallback(async (): Promise<boolean> => {
    if (!key) return false;
    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
    await navigator.serviceWorker.ready;
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setState(permission === "denied" ? "denied" : "off");
      return false;
    }
    const subscription = (await registration.pushManager.getSubscription()) ?? (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToBytes(key) }));
    await send("POST", { subscription: subscription.toJSON() });
    setState("on");
    return true;
  }, [key]);

  const disable = useCallback(async () => {
    const registration = await navigator.serviceWorker.getRegistration("/");
    const subscription = registration ? await registration.pushManager.getSubscription() : null;
    if (subscription) {
      await send("DELETE", { endpoint: subscription.endpoint }).catch(() => undefined);
      await subscription.unsubscribe();
    }
    setState("off");
  }, []);

  return { state, enable, disable };
}

export const PUSH_HINT: Partial<Record<PushState, string>> = {
  install: "No iPhone, toque em Compartilhar › Adicionar à Tela de Início e abra o FitOS por lá para receber avisos.",
  unsupported: "Este navegador não recebe notificações. Use o Chrome no Android ou instale o app no iPhone.",
  unavailable: "Notificações ainda não estão disponíveis.",
  denied: "As notificações estão bloqueadas. Libere nas configurações do navegador para este site.",
};
