"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Sheet } from "@/shared/ui";
import { FreeWorkoutSheet } from "../meus-treinos/FreeWorkoutButton";
import styles from "./StudentPanel.module.css";

export interface StartChoices {
  /// Sessão em andamento: o botão retoma direto (sem duplicar).
  inProgressHref: string | null;
  programmed: { href: string; description: string };
  /// Treino avulso (fluxo existente do Livre); `false` onde não existe.
  free: boolean;
  /// Registro de treino já feito (retroativo); `null` sem a feature.
  done: string | null;
}

/// "Iniciar treino" (proposta 9): abre a escolha "Como deseja treinar?"
/// com Treino programado, Treino avulso e Treino realizado, nesta ordem.
/// Abrir não inicia nada. Com sessão em andamento, o botão vira
/// "Continuar treino". `initialOpen`: o + do aluno abre direto a escolha.
export function StartWorkout({ choices, initialOpen = false }: { choices: StartChoices; initialOpen?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(initialOpen && !choices.inProgressHref);
  const [freeOpen, setFreeOpen] = useState(false);

  if (choices.inProgressHref) {
    return (
      <Button href={choices.inProgressHref} size="xl" block>
        Continuar treino
      </Button>
    );
  }

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <>
      <Button type="button" size="xl" block onClick={() => setOpen(true)} aria-haspopup="dialog">
        Iniciar treino
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Como deseja treinar?">
        <ul className={styles.choices}>
          <li>
            <button type="button" className={styles.choice} onClick={() => go(choices.programmed.href)}>
              <strong>Treino programado</strong>
              <span>{choices.programmed.description}</span>
            </button>
          </li>
          {choices.free ? (
            <li>
              <button
                type="button"
                className={styles.choice}
                onClick={() => {
                  // Uma modal de cada vez: fecha a escolha e abre o foco.
                  setOpen(false);
                  setFreeOpen(true);
                }}
              >
                <strong>Treino avulso</strong>
                <span>Escolher exercícios para agora</span>
              </button>
            </li>
          ) : null}
          {choices.done ? (
            <li>
              <button type="button" className={styles.choice} onClick={() => go(choices.done!)}>
                <strong>Treino realizado</strong>
                <span>Registrar um treino que já fez</span>
              </button>
            </li>
          ) : null}
        </ul>
      </Sheet>
      {choices.free ? <FreeWorkoutSheet open={freeOpen} onClose={() => setFreeOpen(false)} /> : null}
    </>
  );
}
