/// Foco do treino avulso (FitOS Livre): o que o praticante quer treinar,
/// escolhido antes de começar. Regiões e grupos musculares do catálogo
/// (`Exercise.muscle`); a biblioteca abre filtrada e a avaliação cobra o foco.

export const FOCUS_REGIONS = ["Superiores", "Inferiores", "Core", "Aeróbico", "Mobilidade"] as const;
export const FOCUS_MUSCLES = ["Peitoral", "Costas", "Ombros", "Bíceps", "Tríceps", "Trapézio e antebraços", "Quadríceps", "Posteriores de coxa", "Glúteos", "Panturrilhas"] as const;

export type FocusRegion = (typeof FOCUS_REGIONS)[number];
export type Focus = FocusRegion | (typeof FOCUS_MUSCLES)[number];

/// Músculos do catálogo que cada região cobre.
export const REGION_MUSCLES: Record<FocusRegion, string[]> = {
  Superiores: ["Peitoral", "Costas", "Ombros", "Bíceps", "Tríceps", "Trapézio e antebraços"],
  Inferiores: ["Quadríceps", "Posteriores de coxa", "Glúteos", "Panturrilhas"],
  Core: ["Core"],
  Aeróbico: ["Aeróbico"],
  Mobilidade: ["Mobilidade global"],
};

const ALL: readonly string[] = [...FOCUS_REGIONS, ...FOCUS_MUSCLES];

export function isRegion(focus: Focus): focus is FocusRegion {
  return (FOCUS_REGIONS as readonly string[]).includes(focus);
}

/// Só valores conhecidos, sem repetir, na ordem das opções.
export function normalizeFocus(values: unknown): Focus[] {
  if (!Array.isArray(values)) return [];
  return ALL.filter((option) => values.includes(option)) as Focus[];
}

/// Músculos do catálogo cobertos pelo foco (região expandida).
export function focusMuscles(focus: Focus[]): string[] {
  return [...new Set(focus.flatMap((entry) => (isRegion(entry) ? REGION_MUSCLES[entry] : [entry])))];
}
