"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/shared/ui";
import { requestJson } from "../_workout-builder/apiClient";
import styles from "./FreeWorkoutButton.module.css";

/// Treino avulso (FitOS Livre): começa sem treino montado; os exercícios
/// são escolhidos durante a execução.
export function FreeWorkoutButton() {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    try {
      await requestJson("/api/minhas-sessoes/avulso", { method: "POST" });
      router.push("/painel/meus-treinos/sessao");
    } catch (cause) {
      toast.show(cause instanceof Error ? cause.message : "Não foi possível começar.");
      setBusy(false);
    }
  }

  return (
    <button type="button" className={styles.button} disabled={busy} onClick={() => void start()}>
      <span className={styles.icon} aria-hidden="true">
        ⚡
      </span>
      <span className={styles.text}>
        <strong>{busy ? "Começando…" : "Treino avulso"}</strong>
        <span>Pouco tempo ou academia cheia? Escolha cada exercício na hora.</span>
      </span>
      <span className={styles.arrow} aria-hidden="true">
        →
      </span>
    </button>
  );
}
