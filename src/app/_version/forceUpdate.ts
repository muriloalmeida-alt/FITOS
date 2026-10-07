/// "Atualizar versão": garante que o aparelho carregue a versão no ar.
/// Atualiza o service worker (sem desregistrar, para não perder as
/// notificações), apaga o Cache Storage e recarrega ignorando o cache.
/// Login, preferências e o relógio de um treino em andamento ficam.
export async function forceUpdate(win: Window = window): Promise<void> {
  try {
    const registrations = (await win.navigator.serviceWorker?.getRegistrations()) ?? [];
    await Promise.all(registrations.map((registration) => registration.update().catch(() => undefined)));
  } catch {
    // Sem service worker neste navegador.
  }
  try {
    if ("caches" in win) {
      const keys = await win.caches.keys();
      await Promise.all(keys.map((key) => win.caches.delete(key)));
    }
  } catch {
    // Cache Storage indisponível.
  }
  const target = new URL(win.location.href);
  target.searchParams.set("atualizado", String(Date.now()));
  win.location.replace(target.toString());
}

export const INSTALLED_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

export async function fetchLiveVersion(): Promise<string | null> {
  try {
    const response = await fetch(`/api/versao?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) return null;
    return ((await response.json()) as { version?: string }).version ?? null;
  } catch {
    return null;
  }
}
