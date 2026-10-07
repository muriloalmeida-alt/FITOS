/// Avaliação do treino avulso (FitOS Livre): quais áreas o treino mais
/// exigiu, quais ficaram devendo e uma nota de 1 a 5 com o porquê de
/// cada ponto. Regra simples e explicável; usa só o que foi feito: o
/// músculo principal de cada série (catálogo) e as séries da semana.

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

/// `session`: séries deste treino. `week`: séries dos últimos 7 dias,
/// incluindo as deste treino.
export function evaluateWorkout(session: QualitySet[], week: QualitySet[]): WorkoutQuality {
  const counts = countByMuscle(session);
  const weekCounts = countByMuscle(week);
  const total = [...counts.values()].reduce((sum, value) => sum + value, 0);
  const cardioMinutes = Math.round(session.filter((set) => set.type === CARDIO_TYPE).reduce((sum, set) => sum + (set.durationSeconds ?? 0), 0) / 60);

  const worked = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([area, sets]) => ({ area, sets }));

  const gaps = PAIRS.filter(([main, other]) => (counts.get(main) ?? 0) >= 3 && (counts.get(other) ?? 0) * 2 < (counts.get(main) ?? 0));
  const missing: WorkoutQuality["missing"] = gaps.map(([main, other, why]) => ({
    area: other,
    reason: (counts.get(other) ?? 0) === 0 ? `${main} sem ${other.toLowerCase()}: ${why}.` : `Pouco perto de ${main.toLowerCase()}: ${why}.`,
  }));
  for (const area of MAJOR) {
    if (missing.length >= 3) break;
    if ((weekCounts.get(area) ?? 0) === 0 && !missing.some((entry) => entry.area === area)) {
      missing.push({ area, reason: "Nenhuma série nos últimos 7 dias." });
    }
  }

  // Nota: 1 de base + volume (até 2) + equilíbrio (1) + constância (1).
  const reasons: WorkoutQuality["reasons"] = [];
  let points = 0;
  if (total >= 12 || (total === 0 && cardioMinutes >= 20)) {
    points += 2;
    reasons.push({ ok: true, text: total > 0 ? `${total} séries de força: volume bom.` : `${cardioMinutes} min de aeróbico: bom volume.` });
  } else if (total >= 6 || cardioMinutes >= 10) {
    points += 1;
    reasons.push({ ok: true, text: total > 0 ? `${plural(total, "série", "séries")}: dá para chegar a 12 ou mais.` : `${cardioMinutes} min de aeróbico: dá para chegar a 20.` });
  } else {
    reasons.push({ ok: false, text: total > 0 ? `Só ${plural(total, "série", "séries")}: volume baixo.` : "Pouco volume." });
  }

  if (total >= 6 || points > 0) {
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

  const score = Math.min(5, 1 + points) as WorkoutQuality["score"];
  return { score, label: LABELS[score - 1]!, worked, missing: missing.slice(0, 3), reasons, cardioMinutes };
}
