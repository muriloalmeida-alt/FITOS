"use client";

import { useState } from "react";
import { Button, Sheet } from "@/shared/ui";
import { MODALITY_LABEL, type Modality } from "@/shared/lib/modalities";
import type { ProgramChoice, Recommendations, RecommendationOption } from "@/modules/library/recommendationTypes";
import styles from "./ProgramRecommendations.module.css";

export const sameChoice = (a: ProgramChoice | null | undefined, b: ProgramChoice | null | undefined) => Boolean(a && b && a.kind === b.kind && (a.kind === "inicial" || (b.kind === "programa" && a.key === b.key)));

/// "Programas para você" (proposta 11): um grupo por modalidade, os mais
/// compatíveis primeiro. Tocar abre os detalhes; a escolha só vale depois
/// de "Escolher este programa". Modalidade sem conteúdo é avisada.
export function ProgramRecommendations({ data, selected, onSelect, onAdjust }: { data: Recommendations; selected: ProgramChoice | null | undefined; onSelect: (choice: ProgramChoice) => void; onAdjust: () => void }) {
  const [open, setOpen] = useState<RecommendationOption | null>(null);

  return (
    <div className={styles.list}>
      {data.groups.map((group) => (
        <section key={group.label} aria-label={group.label} className={styles.group}>
          <h2 className={styles.cap}>{group.label}</h2>
          {group.options.map((option) => {
            const on = sameChoice(option.choice, selected);
            return (
              <button key={option.name} type="button" className={on ? `${styles.card} ${styles.on}` : styles.card} aria-pressed={on} onClick={() => setOpen(option)}>
                <span className={styles.text}>
                  <span className={styles.name}>{option.name}</span>
                  <span className={styles.facts}>{option.facts.join(" · ")}</span>
                  {on ? <span className={styles.chosen}>✓ Escolhido</span> : null}
                </span>
                <span className={styles.chev} aria-hidden="true">›</span>
              </button>
            );
          })}
        </section>
      ))}
      {data.missing.map((modality: Modality) => (
        <div key={modality} className={styles.empty} role="status">
          <p className={styles.emptyTitle}>{MODALITY_LABEL[modality]}</p>
          <p className={styles.facts}>Ainda não temos programas disponíveis para esta modalidade.</p>
        </div>
      ))}
      {data.groups.length === 0 ? (
        <Button type="button" variant="secondary" block onClick={onAdjust}>
          Ajustar preferências
        </Button>
      ) : null}

      <Sheet
        open={open !== null}
        onClose={() => setOpen(null)}
        title={open?.name ?? "Programa"}
        closable
        description={open ? [open.modalityLabel, ...open.facts].join(" · ") : undefined}
        footer={
          open ? (
            <>
              <Button
                type="button"
                block
                onClick={() => {
                  onSelect(open.choice);
                  setOpen(null);
                }}
              >
                Escolher este programa
              </Button>
              <Button type="button" variant="quiet" block onClick={() => setOpen(null)}>
                Voltar
              </Button>
            </>
          ) : undefined
        }
      >
        {open ? (
          <div className={styles.detail}>
            {open.notes.map((note) => (
              <p key={note} className={styles.facts}>
                {note}
              </p>
            ))}
            {open.workouts.map((workout) => (
              <div key={workout.name} className={styles.workout}>
                <p className={styles.name}>
                  {workout.name}
                  {workout.days ? <span className={styles.facts}> · {workout.days}</span> : null}
                </p>
                {workout.format ? <p className={styles.facts}>{workout.format}</p> : null}
                {workout.exercises.length > 0 ? (
                  <ul className={styles.exercises}>
                    {workout.exercises.map((exercise, index) => (
                      <li key={`${exercise.name}-${index}`}>
                        {exercise.name} <span className={styles.facts}>· {exercise.dose}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
