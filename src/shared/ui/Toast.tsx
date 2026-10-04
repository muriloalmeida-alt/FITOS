"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./Toast.module.css";

interface ToastContextValue {
  show: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_DURATION_MS = 2800;

/// Confirmação curta de ação (FIT-171): "Pagamento registrado", "3
/// exercícios adicionados". Uma região `role="status"` sempre montada (os
/// leitores de tela só anunciam mudanças em regiões já presentes) e uma
/// mensagem por vez, que some sozinha.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((next: string) => {
    if (timer.current) clearTimeout(timer.current);
    setMessage(next);
    timer.current = setTimeout(() => setMessage(null), TOAST_DURATION_MS);
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className={styles.region} role="status" aria-live="polite">
        {message ? <div className={styles.toast}>{message}</div> : null}
      </div>
    </ToastContext.Provider>
  );
}

/// Sem provider (ex.: testes de um componente isolado), `show` não faz nada.
export function useToast(): ToastContextValue {
  return useContext(ToastContext) ?? { show: () => {} };
}
