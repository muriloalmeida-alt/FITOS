/// Séries da tela de evolução (FIT-154 Aluno, FIT-159 Livre): Peso,
/// Gordura e Cintura ao longo das avaliações, e as medidas da primeira
/// para a última avaliação. Função pura, sem banco.

export type EvolutionMetricKey = "peso" | "gordura" | "cintura";

export interface EvolutionSeries {
  key: EvolutionMetricKey;
  label: string;
  unit: string;
  points: { date: string; value: number }[];
}

export interface MeasureChange {
  type: string;
  label: string;
  first: number;
  last: number;
  delta: number;
}

interface AssessmentInput {
  recordedAt: Date;
  weightGrams: number | null;
  bodyFatTenthPercent: number | null;
  measurements: { type: string; valueMillimeters: number }[];
}

export const MEASUREMENT_LABEL: Record<string, string> = {
  CINTURA: "Cintura",
  QUADRIL: "Quadril",
  PEITO: "Peito",
  BRACO: "Braço",
  COXA: "Coxa",
  PANTURRILHA: "Panturrilha",
};

/// `assessments` em qualquer ordem; as séries saem da mais antiga para a
/// mais recente e só com métricas que têm ao menos um valor.
export function buildEvolution(assessments: AssessmentInput[]): { series: EvolutionSeries[]; measures: MeasureChange[] } {
  const ordered = [...assessments].sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());
  const waist = (assessment: AssessmentInput) => assessment.measurements.find((measurement) => measurement.type === "CINTURA")?.valueMillimeters ?? null;
  const all: EvolutionSeries[] = [
    { key: "peso", label: "Peso", unit: "kg", points: ordered.filter((a) => a.weightGrams !== null).map((a) => ({ date: a.recordedAt.toISOString(), value: a.weightGrams! / 1000 })) },
    { key: "gordura", label: "Gordura", unit: "%", points: ordered.filter((a) => a.bodyFatTenthPercent !== null).map((a) => ({ date: a.recordedAt.toISOString(), value: a.bodyFatTenthPercent! / 10 })) },
    { key: "cintura", label: "Cintura", unit: "cm", points: ordered.filter((a) => waist(a) !== null).map((a) => ({ date: a.recordedAt.toISOString(), value: waist(a)! / 10 })) },
  ];

  const measures: MeasureChange[] = [];
  for (const type of Object.keys(MEASUREMENT_LABEL)) {
    const values = ordered.map((a) => a.measurements.find((measurement) => measurement.type === type)?.valueMillimeters ?? null).filter((value): value is number => value !== null);
    if (values.length === 0) continue;
    const first = values[0]! / 10;
    const last = values[values.length - 1]! / 10;
    measures.push({ type, label: MEASUREMENT_LABEL[type]!, first, last, delta: Math.round((last - first) * 10) / 10 });
  }
  return { series: all.filter((entry) => entry.points.length > 0), measures };
}
