"use client";

import { useEffect, useState } from "react";
import { Button } from "@/shared/ui";
import styles from "./AlunoHome.module.css";

const KEY = "fitos:pesar:depois";

/// "Pesar hoje?" (EPIC-30): aparece quando a última pesagem tem duas
/// semanas ou mais. "Depois" esconde até amanhã, neste aparelho.
export function WeighPrompt({ lastLabel, todayKey }: { lastLabel: string | null; todayKey: string }) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- lê o armazenamento do navegador após a hidratação
      if (window.localStorage.getItem(KEY) === todayKey) setHidden(true);
    } catch {
      // Sem armazenamento: o cartão continua visível.
    }
  }, [todayKey]);
  if (hidden) return null;
  return (
    <section className={styles.ask} aria-label="Pede você">
      <p className={styles.askTitle}>Pesar hoje?</p>
      <p className={styles.heroMeta}>{lastLabel ? `A última foi em ${lastLabel}.` : "Ainda não tem nenhum peso registrado."}</p>
      <div className={styles.askActions}>
        <Button href="/painel/pesar" block>
          Pesar agora
        </Button>
        <Button
          type="button"
          variant="secondary"
          block
          onClick={() => {
            setHidden(true);
            try {
              window.localStorage.setItem(KEY, todayKey);
            } catch {
              // Ignora: só esconde nesta visita.
            }
          }}
        >
          Depois
        </Button>
      </div>
    </section>
  );
}
