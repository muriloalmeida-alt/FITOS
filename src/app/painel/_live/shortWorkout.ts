import type { LiveItem } from "./LiveWorkout";

/// "Só tenho X min" (EPIC-38): uma versão menor do treino de hoje, só para
/// esta sessão (o programa não muda). Primeiro corta para 2 séries; depois
/// encurta os aeróbicos; por fim, deixa os últimos exercícios para outro
/// dia (sempre ficam ao menos 2).

const WORK_SECONDS = 40;
const REST_SECONDS = 60;
const MIN_CARDIO_SECONDS = 5 * 60;
export const SHORT_OPTIONS = [20, 30, 45] as const;

function sets(item: LiveItem): number {
  if (item.intensity) return 1;
  return item.sets && item.sets > 0 ? item.sets : 1;
}

function secondsOf(item: LiveItem): number {
  if (item.intensity) return item.durationSeconds ?? 0;
  return sets(item) * ((item.durationSeconds ?? WORK_SECONDS) + (item.restSeconds ?? REST_SECONDS));
}

export function workoutMinutes(items: LiveItem[]): number {
  return Math.max(5, Math.round(items.reduce((sum, item) => sum + secondsOf(item), 0) / 300) * 5);
}

/// Opções menores que o treino inteiro (com folga de 5 min).
export function shortOptions(items: LiveItem[]): number[] {
  const full = workoutMinutes(items);
  return SHORT_OPTIONS.filter((minutes) => minutes <= full - 5);
}

export interface ShortPlan {
  items: LiveItem[];
  /// Exercícios que ficam para outro dia.
  dropped: string[];
  setsCut: boolean;
  cardioCut: boolean;
}

export function fitToMinutes(original: LiveItem[], minutes: number): ShortPlan {
  const budget = minutes * 60;
  const total = (list: LiveItem[], skip: Set<string>) => list.filter((item) => !skip.has(item.id)).reduce((sum, item) => sum + secondsOf(item), 0);
  const dropped = new Set<string>();

  let items = original.map((item) => (!item.intensity && sets(item) > 2 ? { ...item, sets: 2 } : item));
  const setsCut = items.some((item, index) => item !== original[index]);

  let cardioCut = false;
  const over = total(items, dropped) - budget;
  if (over > 0) {
    const cardio = items.filter((item) => item.intensity && (item.durationSeconds ?? 0) > MIN_CARDIO_SECONDS);
    const room = cardio.reduce((sum, item) => sum + (item.durationSeconds! - MIN_CARDIO_SECONDS), 0);
    if (room > 0) {
      const ratio = Math.min(1, over / room);
      items = items.map((item) => {
        if (!cardio.includes(item)) return item;
        const cut = Math.round(((item.durationSeconds! - MIN_CARDIO_SECONDS) * ratio) / 60) * 60;
        return cut > 0 ? { ...item, durationSeconds: item.durationSeconds! - cut } : item;
      });
      cardioCut = items.some((item, index) => item.durationSeconds !== original[index]!.durationSeconds && item.intensity);
    }
  }

  for (let index = items.length - 1; index >= 2 && total(items, dropped) > budget; index -= 1) {
    dropped.add(items[index]!.id);
  }
  // O aviso de "aeróbico mais curto" só vale para o que ficou no treino.
  cardioCut = cardioCut && items.some((item, index) => item.intensity && !dropped.has(item.id) && item.durationSeconds !== original[index]!.durationSeconds);
  return { items, dropped: [...dropped], setsCut, cardioCut };
}
