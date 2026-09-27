"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./RestTimer.module.css";

interface RestTimerProps {
  seconds: number;
  label?: string;
  onComplete?: () => void;
}

function formatTime(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const minutes = Math.floor(clamped / 60);
  const remaining = clamped % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}

/// Temporizador de descanso entre séries (docs/03-experience/UX-ARCHITECTURE.md
/// — "descansar com temporizador" na jornada do aluno). Contagem numérica
/// simples, sem animação de progresso — nunca conflita com
/// `prefers-reduced-motion` (não há nada para desativar: é só texto que
/// muda a cada segundo). Sem `aria-live`, deliberadamente: um timer que
/// anuncia a cada segundo para leitor de tela é ruído, não ajuda —
/// `aria-label` estático deixa o valor disponível sob demanda.
export function RestTimer({ seconds, label = "Tempo para você", onComplete }: RestTimerProps) {
  const [prevSeconds, setPrevSeconds] = useState(seconds);
  const [remaining, setRemaining] = useState(seconds);
  if (seconds !== prevSeconds) {
    setPrevSeconds(seconds);
    setRemaining(seconds);
  }

  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (remaining <= 0) {
      onCompleteRef.current?.();
      return;
    }
    const timeoutId = setTimeout(() => setRemaining((current) => current - 1), 1000);
    return () => clearTimeout(timeoutId);
  }, [remaining]);

  return (
    <div className={styles.timer}>
      <span className={styles.label}>{label}</span>
      <strong className={styles.value} aria-label={`${label}: ${formatTime(remaining)}`}>
        {formatTime(remaining)}
      </strong>
    </div>
  );
}
