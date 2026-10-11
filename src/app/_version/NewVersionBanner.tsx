"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { INSTALLED_VERSION, fetchLiveVersion, forceUpdate } from "./forceUpdate";
import styles from "./NewVersionBanner.module.css";

const CHECK_EVERY_MS = 5 * 60 * 1000;
const DISMISSED_KEY = "fitos:versao:adiada";

function dismissedVersion(): string | null {
  try {
    return window.sessionStorage.getItem(DISMISSED_KEY);
  } catch {
    return null;
  }
}

/// Aviso automático de versão nova: ao abrir, ao voltar ao app e a cada
/// 5 min compara a versão do aparelho com a no ar. "Atualizar" faz o
/// mesmo que o botão escondido; "Depois" some até a próxima versão (ou
/// até fechar o app). Não aparece no treino ao vivo nem fora do Railway.
export function NewVersionBanner() {
  const pathname = usePathname();
  const [live, setLive] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);

  const check = useCallback(async () => {
    if (INSTALLED_VERSION === "dev") return;
    const version = await fetchLiveVersion();
    if (version && version !== "dev") setLive(version);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a versão no ar só chega depois da rede (assíncrono)
    void check();
    const id = window.setInterval(() => void check(), CHECK_EVERY_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [check]);

  const outdated = live !== null && live !== INSTALLED_VERSION;
  if (!outdated || hidden || dismissedVersion() === live || pathname?.includes("/sessao")) return null;

  return (
    <div className={styles.banner} role="status" aria-live="polite">
      <span className={styles.text}>
        <strong>Nova versão disponível</strong>
        <span>Atualize para ver as novidades.</span>
      </span>
      <button
        type="button"
        className={styles.later}
        onClick={() => {
          try {
            window.sessionStorage.setItem(DISMISSED_KEY, live);
          } catch {
            // Sem armazenamento: só esconde agora.
          }
          setHidden(true);
        }}
      >
        Depois
      </button>
      <button
        type="button"
        className={styles.update}
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void forceUpdate();
        }}
      >
        {busy ? "Atualizando…" : "Atualizar"}
      </button>
    </div>
  );
}
