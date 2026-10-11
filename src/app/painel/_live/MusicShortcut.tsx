"use client";

import { useState } from "react";
import { MUSIC_PROVIDERS, MUSIC_SERVICES, type MusicProvider } from "@/shared/lib/music";
import styles from "./MusicShortcut.module.css";

function ServiceIcon({ provider, size = 28 }: { provider: MusicProvider; size?: number }) {
  if (provider === "spotify") {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="16" r="16" fill="#1ED760" />
        <path d="M8.5 12.2c5-1.5 10.6-1.1 15 1.2M9.3 16.3c4.2-1.2 8.8-.8 12.5 1.1M10.2 20.2c3.4-.9 7-.6 10 .9" fill="none" stroke="#0B0F14" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#FA2D48" />
      <path d="M13 21.5V10.8l9-2v10.6" fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="11" cy="21.5" r="2.4" fill="#fff" />
      <circle cx="20" cy="19.4" r="2.4" fill="#fff" />
    </svg>
  );
}

/// Abre o serviço no gesto do usuário (sem esperar a rede) e grava a
/// preferência em seguida. `null` = o navegador bloqueou a abertura.
function openService(provider: MusicProvider): boolean {
  const opened = window.open(MUSIC_SERVICES[provider].url, "_blank");
  if (!opened) return false;
  try {
    opened.opener = null;
  } catch {
    // Janela de outro app: nada a desligar.
  }
  return true;
}

function savePreference(provider: MusicProvider) {
  void fetch("/api/preferencias/musica", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider }) }).catch(() => undefined);
}

interface Props {
  initial: MusicProvider | null;
  /// "prepare": na preparação do treino. "run": ícone ao lado do cronômetro.
  variant: "prepare" | "run";
}

/// Música em um toque (PRD v2.1): primeiro uso mostra Spotify e Apple
/// Music; depois, só "Abrir <serviço>" com "Trocar". Sem login, player ou
/// listas. Falha verificável aparece inline, sem travar o treino.
export function MusicShortcut({ initial, variant }: Props) {
  const [preferred, setPreferred] = useState<MusicProvider | null>(initial);
  const [picking, setPicking] = useState(false);
  const [failed, setFailed] = useState<MusicProvider | null>(null);

  function choose(provider: MusicProvider) {
    const ok = openService(provider);
    setPreferred(provider);
    setPicking(false);
    setFailed(ok ? null : provider);
    if (provider !== preferred) savePreference(provider);
  }

  const failure = failed ? (
    <p className={styles.failure} role="alert">
      Não foi possível abrir.{" "}
      <button type="button" className={styles.link} onClick={() => choose(failed)}>
        Tentar novamente
      </button>
    </p>
  ) : null;

  const picker = (
    <div className={styles.picker} role="group" aria-label="Escolher serviço de música">
      {MUSIC_PROVIDERS.map((provider) => (
        <button key={provider} type="button" className={styles.service} onClick={() => choose(provider)}>
          <ServiceIcon provider={provider} />
          <span>{MUSIC_SERVICES[provider].name}</span>
        </button>
      ))}
      {preferred && picking ? (
        <button type="button" className={styles.link} onClick={() => setPicking(false)}>
          Cancelar
        </button>
      ) : null}
    </div>
  );

  if (variant === "run") {
    return (
      <div className={styles.run}>
        <button
          type="button"
          className={styles.runButton}
          aria-label={preferred ? `Abrir ${MUSIC_SERVICES[preferred].name}` : "Música"}
          aria-expanded={preferred ? undefined : picking}
          onClick={() => (preferred ? choose(preferred) : setPicking(!picking))}
        >
          {preferred ? <ServiceIcon provider={preferred} size={30} /> : <span aria-hidden="true">♪</span>}
        </button>
        {picking ? <div className={styles.popover}>{picker}</div> : null}
        {failure ? <div className={styles.popover}>{failure}</div> : null}
      </div>
    );
  }

  return (
    <section className={styles.prepare} aria-label="Música">
      <p className={styles.cap}>Música</p>
      {preferred && !picking ? (
        <div className={styles.row}>
          <button type="button" className={styles.openButton} onClick={() => choose(preferred)}>
            <ServiceIcon provider={preferred} />
            <span>Abrir {MUSIC_SERVICES[preferred].name}</span>
          </button>
          <button type="button" className={styles.link} onClick={() => setPicking(true)}>
            Trocar
          </button>
        </div>
      ) : (
        picker
      )}
      {failure}
    </section>
  );
}
