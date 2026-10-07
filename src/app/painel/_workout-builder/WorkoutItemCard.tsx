"use client";

import { useState } from "react";
import { CardioIcon, ExerciseThumbnail, Stepper } from "@/shared/ui";
import {
  CARDIO_INTENSITY_LABELS,
  CARDIO_MAX_SECONDS,
  CARDIO_MIN_SECONDS,
  CARDIO_STEP_SECONDS,
  nextIntensity,
} from "@/shared/lib/cardio";
import {
  formatLoadForStorage,
  formatLoadLabel,
  parseLoadKg,
} from "@/shared/lib/load";
import type { EditorItem } from "./types";
import styles from "./WorkoutItemCard.module.css";

export type ItemPatch = Partial<
  Pick<
    EditorItem,
    | "sets"
    | "reps"
    | "durationSeconds"
    | "load"
    | "restSeconds"
    | "notes"
    | "intensity"
  >
>;

interface WorkoutItemCardProps {
  item: EditorItem;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onChange: (patch: ItemPatch) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  /// EPIC-30: tocar na foto abre outros exercícios do mesmo grupo.
  onSwap?: () => void;
}

/// Um exercício dentro do editor (FIT-146): séries, repetições ou tempo e
/// carga com +/−; descanso, "medir por" e observação em "mais opções".
/// Nenhum campo numérico digitado. Carga em texto livre antigo (ex.:
/// "moderada") é preservada e mostrada como está até o personal ajustar.
export function WorkoutItemCard({
  item,
  index,
  isFirst,
  isLast,
  onChange,
  onMove,
  onRemove,
  onSwap,
}: WorkoutItemCardProps) {
  const [open, setOpen] = useState(false);
  const cardio = Boolean(item.intensity);
  const timed = item.durationSeconds !== null && item.reps === null;
  const loadKg = parseLoadKg(item.load);

  return (
    <li className={styles.card}>
      <div className={styles.head}>
        {onSwap ? (
          <button type="button" className={styles.swapThumb} onClick={onSwap} aria-label={`Trocar ${item.name}`}>
            {cardio && !item.imageUrl ? <CardioIcon size={56} /> : <ExerciseThumbnail src={item.imageUrl} alt="" width={56} height={56} className={styles.thumb} />}
            <span className={styles.swapBadge} aria-hidden="true">
              ⇄
            </span>
          </button>
        ) : cardio && !item.imageUrl ? (
          <CardioIcon size={56} />
        ) : (
          <ExerciseThumbnail
            src={item.imageUrl}
            alt={item.imageAlt ?? ""}
            width={56}
            height={56}
            className={styles.thumb}
          />
        )}
        <div className={styles.text}>
          <span className={styles.num}>
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className={styles.name}>{item.name}</span>
          {cardio ? (
            <span className={styles.muscle}>Aeróbico</span>
          ) : item.muscle ? (
            <span className={styles.muscle}>{item.muscle}</span>
          ) : null}
        </div>
        <div className={styles.order}>
          <button
            type="button"
            className={styles.small}
            onClick={() => onMove(-1)}
            disabled={isFirst}
            aria-label={`Mover ${item.name} para cima`}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="m6 15 6-6 6 6" />
            </svg>
          </button>
          <button
            type="button"
            className={styles.small}
            onClick={() => onMove(1)}
            disabled={isLast}
            aria-label={`Mover ${item.name} para baixo`}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        </div>
      </div>

      {cardio ? (
        <div className={styles.cardio}>
          <Stepper
            label="Tempo"
            value={Math.round((item.durationSeconds ?? 1200) / 60)}
            step={CARDIO_STEP_SECONDS / 60}
            min={CARDIO_MIN_SECONDS / 60}
            max={CARDIO_MAX_SECONDS / 60}
            format={(v) => `${v} min`}
            onChange={(minutes) => onChange({ durationSeconds: minutes * 60 })}
          />
          <div>
            <span className={styles.label}>Intensidade</span>
            <button
              type="button"
              className={styles.intensity}
              onClick={() =>
                onChange({ intensity: nextIntensity(item.intensity) })
              }
            >
              {item.intensity
                ? CARDIO_INTENSITY_LABELS[item.intensity]
                : "Moderado"}
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.steps}>
          <Stepper
            label="Séries"
            value={item.sets ?? 3}
            min={1}
            max={10}
            onChange={(sets) => onChange({ sets })}
          />
          {timed ? (
            <Stepper
              label="Tempo"
              value={item.durationSeconds ?? 30}
              step={5}
              min={5}
              max={600}
              format={(v) => `${v} s`}
              onChange={(durationSeconds) => onChange({ durationSeconds })}
            />
          ) : (
            <Stepper
              label="Reps"
              value={item.reps ?? 12}
              min={1}
              max={60}
              onChange={(reps) => onChange({ reps })}
            />
          )}
          {loadKg === null ? (
            <div className={styles.freeLoad}>
              <span className={styles.label}>Carga</span>
              <button
                type="button"
                className={styles.freeLoadValue}
                onClick={() => onChange({ load: null })}
                title="Trocar por carga em kg"
              >
                {item.load}
              </button>
            </div>
          ) : (
            <Stepper
              label="Carga"
              value={loadKg}
              step={2.5}
              min={0}
              max={500}
              format={formatLoadLabel}
              onChange={(kg) => onChange({ load: formatLoadForStorage(kg) })}
            />
          )}
        </div>
      )}

      {open && !cardio ? (
        <div className={styles.more}>
          <div className={styles.moreGrid}>
            <div>
              <span className={styles.label} id={`medir-${item.id}`}>
                Medir por
              </span>
              <div
                className={styles.mini}
                role="radiogroup"
                aria-labelledby={`medir-${item.id}`}
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={!timed}
                  className={!timed ? styles.miniOn : undefined}
                  onClick={() =>
                    onChange({ reps: item.reps ?? 12, durationSeconds: null })
                  }
                >
                  Repetições
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={timed}
                  className={timed ? styles.miniOn : undefined}
                  onClick={() =>
                    onChange({
                      reps: null,
                      durationSeconds: item.durationSeconds ?? 30,
                    })
                  }
                >
                  Tempo
                </button>
              </div>
            </div>
            <Stepper
              label="Descanso"
              value={item.restSeconds ?? 60}
              step={15}
              min={0}
              max={300}
              format={(v) => `${v} s`}
              onChange={(restSeconds) => onChange({ restSeconds })}
            />
          </div>
          <label className={styles.noteField}>
            <span className={styles.label}>Observação</span>
            <input
              className={styles.note}
              defaultValue={item.notes ?? ""}
              placeholder="Ex.: descer devagar"
              maxLength={500}
              onChange={(event) => onChange({ notes: event.target.value })}
            />
          </label>
        </div>
      ) : null}

      <div className={styles.footer}>
        {cardio ? (
          <span />
        ) : (
          <button
            type="button"
            className={styles.small}
            aria-expanded={open}
            onClick={() => setOpen((current) => !current)}
          >
            {open ? "Menos opções" : "Tempo, descanso e observação"}
          </button>
        )}
        <button
          type="button"
          className={styles.small}
          onClick={onRemove}
          aria-label={`Remover ${item.name}`}
        >
          Remover
        </button>
      </div>
    </li>
  );
}
