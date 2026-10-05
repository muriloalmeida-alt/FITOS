"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Button, Sheet } from "@/shared/ui";
import styles from "./InstallGuide.module.css";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

let deferred: InstallPrompt | null = null;
const listeners = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as InstallPrompt;
    listeners.forEach((listener) => listener());
  });
}

/// Android/Chrome: o convite "Instalar app" do próprio navegador, quando
/// ele oferece (EPIC-38).
export function useInstallPrompt(): { canInstall: boolean; install: () => Promise<boolean> } {
  const [canInstall, setCanInstall] = useState(false);
  useEffect(() => {
    const update = () => setCanInstall(deferred !== null);
    update();
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);
  return {
    canInstall,
    install: async () => {
      if (!deferred) return false;
      const prompt = deferred;
      deferred = null;
      setCanInstall(false);
      await prompt.prompt();
      return (await prompt.userChoice).outcome === "accepted";
    },
  };
}

function ShareIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12" />
      <path d="M8 7l4-4 4 4" />
      <path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
    </svg>
  );
}

function PlusSquareIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

/// Passo a passo para instalar o FitOS no iPhone (EPIC-38): o iOS só
/// entrega notificações para o app aberto pela Tela de Início.
export function InstallGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Instale o FitOS no iPhone"
      description="No iPhone, os avisos só chegam com o FitOS na Tela de Início. Leva 10 segundos."
      footer={
        <Button type="button" block onClick={onClose}>
          Entendi
        </Button>
      }
    >
      <ol className={styles.steps}>
        <li>
          <span className={styles.icon}>
            <ShareIcon />
          </span>
          <span>
            Toque em <strong>Compartilhar</strong> na barra do navegador.
          </span>
        </li>
        <li>
          <span className={styles.icon}>
            <PlusSquareIcon />
          </span>
          <span>
            Role e toque em <strong>Adicionar à Tela de Início</strong>, depois em <strong>Adicionar</strong>.
          </span>
        </li>
        <li>
          <span className={styles.icon} aria-hidden="true">
            <Image src="/marca/fitos-icone-192px.png" alt="" width={26} height={26} unoptimized loading="eager" className={styles.appIcon} />
          </span>
          <span>
            Abra o FitOS pelo ícone na Tela de Início e ligue os avisos de novo.
          </span>
        </li>
      </ol>
    </Sheet>
  );
}
