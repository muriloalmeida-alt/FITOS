"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./Toast.module.css";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastContextValue {
  /// `action` (ex.: Desfazer) fica disponível enquanto o aviso aparece.
  show: (message: string, action?: ToastAction) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_DURATION_MS = 2800;
const TOAST_WITH_ACTION_MS = 5000;

/// Confirmação curta de ação (FIT-171): "Pagamento registrado", "3
/// exercícios adicionados". Uma região `role="status"` sempre montada (os
/// leitores de tela só anunciam mudanças em regiões já presentes) e uma
/// mensagem por vez, que some sozinha.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const [action, setAction] = useState<ToastAction | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setMessage(null);
    setAction(null);
  }, []);

  const show = useCallback((next: string, nextAction?: ToastAction) => {
    if (timer.current) clearTimeout(timer.current);
    setMessage(next);
    setAction(nextAction ?? null);
    timer.current = setTimeout(hide, nextAction ? TOAST_WITH_ACTION_MS : TOAST_DURATION_MS);
  }, [hide]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className={styles.region} role="status" aria-live="polite">
        {message ? (
          <div className={styles.toast}>
            <span>{message}</span>
            {action ? (
              <button
                type="button"
                className={styles.action}
                onClick={() => {
                  action.onClick();
                  hide();
                }}
              >
                {action.label}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}

/// Sem provider (ex.: testes de um componente isolado), `show` não faz nada.
export function useToast(): ToastContextValue {
  return useContext(ToastContext) ?? { show: () => {} };
}
