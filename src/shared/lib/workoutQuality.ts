/// Avaliação do treino avulso (FitOS Livre): quais áreas o treino mais
/// exigiu, quais ficaram devendo e uma nota de 1 a 5 com o porquê de
/// cada ponto. Regra simples e explicável; usa só o que foi feito: o
/// músculo principal de cada série (catálogo) e as séries da semana.
/// Com foco escolhido antes de começar, a nota cobra o foco e o
/// desequilíbrio só pesa quando o outro lado também está no foco.

import { focusMuscles, isRegion, REGION_MUSCLES, type Focus } from "./workoutFocus";

export interface QualitySet {
  /// Músculo principal do exercício feito (`Exercise.muscle`).
  muscle: string | null;
  /// Tipo do exercício (`Exercise.type`): aeróbico e mobilidade não contam como série de força.
  type: string | null;
  durationSeconds: number | null;
  exerciseId: string;
}

export interface WorkoutQuality {
  score: 1 | 2 | 3 | 4 | 5;
  label: string;
  /// Mais exigidas: até 3 áreas com mais séries neste treino.
  worked: { area: string; sets: number }[];
  /// Ficaram devendo: área e motivo, até 3.
  missing: { area: string; reason: string }[];
  /// O que pesou na nota, na ordem dos critérios.
  reasons: { ok: boolean; text: string }[];
  cardioMinutes: number;
}

const CARDIO_TYPE = "Aeróbico";
const MOBILITY_TYPE = "Alongamento e mobilidade";

/// Pares que se equilibram: treinar muito um lado e nada do outro pesa.
const PAIRS: [string, string, string][] = [
  ["Peitoral", "Costas", "puxar equilibra o empurrar do peito"],
  ["Costas", "Peitoral", "empurrar equilibra o puxar das costas"],
  ["Quadríceps", "Posteriores de coxa", "equilibra a frente da coxa e protege o joelho"],
  ["Bíceps", "Tríceps", "equilibra o braço"],
  ["Tríceps", "Bíceps", "equilibra o braço"],
];

/// Grupos grandes que entram na conta da semana.
const MAJOR = ["Peitoral", "Costas", "Ombros", "Quadríceps", "Posteriores de coxa", "Glúteos", "Core"];

const LABELS = ["Leve demais", "Deu para começar", "Bom treino", "Muito bom", "Treino completo"] as const;

function strengthSets(sets: QualitySet[]) {
  return sets.filter((set) => set.type !== CARDIO_TYPE && set.type !== MOBILITY_TYPE && set.muscle);
}

function countByMuscle(sets: QualitySet[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const set of strengthSets(sets)) counts.set(set.muscle!, (counts.get(set.muscle!) ?? 0) + 1);
  return counts;
}

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

/// Quanto do foco foi feito e a meta: grupo 3 séries, região de força 6,
/// aeróbico 10 min, mobilidade 2 séries.
function focusProgress(focus: Focus, counts: Map<string, number>, cardioMinutes: number, mobilitySets: number) {
  if (focus === "Aeróbico") return { done: cardioMinutes, goal: 10, unit: "min" };
  if (focus === "Mobilidade") return { done: mobilitySets, goal: 2, unit: "séries" };
  const muscles = isRegion(focus) ? REGION_MUSCLES[focus] : [focus];
  const done = muscles.reduce((sum, muscle) => sum + (counts.get(muscle) ?? 0), 0);
  return { done, goal: focus === "Superiores" || focus === "Inferiores" ? 6 : 3, unit: "séries" };
}

/// `session`: séries deste treino. `week`: séries dos últimos 7 dias,
/// incluindo as deste treino. `focus`: o que o praticante escolheu treinar.
export function evaluateWorkout(session: QualitySet[], week: QualitySet[], focus: Focus[] = []): WorkoutQuality {
  const counts = countByMuscle(session);
  const weekCounts = countByMuscle(week);
  const total = [...counts.values()].reduce((sum, value) => sum + value, 0);
  const cardioMinutes = Math.round(session.filter((set) => set.type === CARDIO_TYPE).reduce((sum, set) => sum + (set.durationSeconds ?? 0), 0) / 60);

  const worked = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([area, sets]) => ({ area, sets }));

  const mobilitySets = session.filter((set) => set.type === MOBILITY_TYPE).length;
  const covered = focusMuscles(focus);
  const focusMisses = focus
    .map((entry) => ({ entry, ...focusProgress(entry, counts, cardioMinutes, mobilitySets) }))
    .filter((progress) => progress.done < progress.goal);
  // Com foco, o outro lado só é cobrado quando também foi escolhido.
  const gaps = PAIRS.filter(([main, other]) => (focus.length === 0 || covered.includes(other)) && (counts.get(main) ?? 0) >= 3 && (counts.get(other) ?? 0) * 2 < (counts.get(main) ?? 0));
  const missing: WorkoutQuality["missing"] = focusMisses.map((progress) => ({
    area: progress.entry,
    reason: `Você escolheu treinar: ${progress.done} de ${progress.goal} ${progress.unit}.`,
  }));
  for (const [main, other, why] of gaps) {
    if (missing.some((entry) => entry.area === other)) continue;
    missing.push({
      area: other,
      reason: (counts.get(other) ?? 0) === 0 ? `${main} sem ${other.toLowerCase()}: ${why}.` : `Pouco perto de ${main.toLowerCase()}: ${why}.`,
    });
  }
  for (const area of MAJOR) {
    if (missing.length >= 3) break;
    if ((weekCounts.get(area) ?? 0) === 0 && !missing.some((entry) => entry.area === area)) {
      missing.push({ area, reason: "Nenhuma série nos últimos 7 dias." });
    }
  }

  // Nota: 1 de base + volume (até 2) + equilíbrio (1) + constância (1),
  // e foco (1) quando foi escolhido; os pontos são escalados para 1 a 5.
  const reasons: WorkoutQuality["reasons"] = [];
  let points = 0;
  if (focus.length > 0) {
    if (focusMisses.length === 0) {
      points += 1;
      reasons.push({ ok: true, text: `Foco cumprido: ${focus.join(", ")}.` });
    } else {
      reasons.push({ ok: false, text: `Faltou do foco: ${focusMisses.map((progress) => progress.entry).join(", ")}.` });
    }
  }
  if (total >= 12 || (total === 0 && cardioMinutes >= 20)) {
    points += 2;
    reasons.push({ ok: true, text: total > 0 ? `${total} séries de força: volume bom.` : `${cardioMinutes} min de aeróbico: bom volume.` });
  } else if (total >= 6 || cardioMinutes >= 10) {
    points += 1;
    reasons.push({ ok: true, text: total > 0 ? `${plural(total, "série", "séries")}: dá para chegar a 12 ou mais.` : `${cardioMinutes} min de aeróbico: dá para chegar a 20.` });
  } else {
    reasons.push({ ok: false, text: total > 0 ? `Só ${plural(total, "série", "séries")}: volume baixo.` : "Pouco volume." });
  }

  const balanceApplies = total >= 6 || points > (focus.length > 0 && focusMisses.length === 0 ? 1 : 0);
  if (balanceApplies) {
    if (gaps.length === 0) {
      points += 1;
      reasons.push({ ok: true, text: "Músculos opostos equilibrados." });
    } else {
      reasons.push({ ok: false, text: `Desequilíbrio: ${gaps.map(([main, other]) => `${main.toLowerCase()} sem ${other.toLowerCase()}`).join(", ")}.` });
    }
  }

  const perExercise = new Map<string, number>();
  for (const set of strengthSets(session)) perExercise.set(set.exerciseId, (perExercise.get(set.exerciseId) ?? 0) + 1);
  const single = [...perExercise.values()].filter((value) => value < 2).length;
  if (perExercise.size > 0 && single === 0) {
    points += 1;
    reasons.push({ ok: true, text: "Cada exercício com 2 séries ou mais." });
  } else if (perExercise.size > 0) {
    reasons.push({ ok: false, text: `${plural(single, "exercício ficou", "exercícios ficaram")} com 1 série só.` });
  }

  // Com foco, só contam os critérios que se aplicam ao que foi escolhido
  // (aeróbico e mobilidade não têm constância de séries de força).
  const possible = focus.length > 0 ? 3 + (balanceApplies ? 1 : 0) + (perExercise.size > 0 ? 1 : 0) : 4;
  const score = Math.min(5, 1 + Math.round((4 * points) / possible)) as WorkoutQuality["score"];
  return { score, label: LABELS[score - 1]!, worked, missing: missing.slice(0, 3), reasons, cardioMinutes };
}
