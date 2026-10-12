"use client";

import { useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sheet } from "@/shared/ui";
import { NavIcon } from "@/shared/ui/NavIcon";
import type { QuickAction } from "./quickActions";
import styles from "./QuickAccess.module.css";

/// Telas sem navegação inferior (treino ao vivo, registro) não mostram o +.
const HIDDEN_ON = [/^\/painel\/treino\/sessao/, /^\/painel\/meus-treinos\/sessao/, /^\/painel\/treinos-realizados\/registrar/, /^\/painel\/primeiros-passos/, /^\/painel\/admin/];

/// Acesso rápido (proposta 7): botão + flutuante no canto inferior direito
/// e uma modal inferior compacta, sem título visível, com os atalhos do
/// perfil (servidor). Ao escolher, fecha e abre o destino; o + some
/// enquanto a modal está aberta e recebe o foco de volta ao fechar.
export function QuickAccess() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [actions, setActions] = useState<QuickAction[] | null>(null);
  const [error, setError] = useState(false);
  const [going, setGoing] = useState<string | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  if (HIDDEN_ON.some((pattern) => pattern.test(pathname ?? ""))) return null;

  async function load() {
    setError(false);
    const response = await fetch("/api/acesso-rapido").catch(() => null);
    const body = response?.ok ? ((await response.json().catch(() => null)) as { actions?: QuickAction[] } | null) : null;
    if (!body?.actions) return setError(true);
    setActions(body.actions);
  }

  function show() {
    setOpen(true);
    setGoing(null);
    void load();
  }

  function close() {
    setOpen(false);
    // O + volta a aparecer; o foco volta para ele.
    requestAnimationFrame(() => trigger.current?.focus());
  }

  function go(action: QuickAction) {
    if (going) return;
    setGoing(action.key);
    setOpen(false);
    router.push(action.href);
  }

  return (
    <>
      {/* Espaço extra no fim da página: o + nunca cobre o último conteúdo. */}
      <div className={styles.spacer} aria-hidden="true" />
      {open ? null : (
        <button ref={trigger} type="button" className={styles.fab} onClick={show} aria-label="Abrir ações" aria-expanded={open} aria-haspopup="dialog">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      )}
      <Sheet open={open} onClose={close} title="Ações disponíveis" compact>
        <ul className={styles.list}>
          {actions === null && !error
            ? [0, 1].map((index) => <li key={index} className={styles.skeleton} aria-hidden="true" />)
            : null}
          {error ? (
            <li className={styles.error}>
              Não foi possível carregar.{" "}
              <button type="button" className={styles.retry} onClick={() => void load()}>
                Tentar de novo
              </button>
            </li>
          ) : null}
          {actions?.map((action) => (
            <li key={action.key}>
              <button type="button" className={styles.action} onClick={() => go(action)} disabled={going !== null}>
                <span className={styles.icon} aria-hidden="true">
                  <NavIcon name={action.icon} />
                </span>
                <span>{action.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}
