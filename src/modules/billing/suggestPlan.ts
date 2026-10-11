import type { PersonalStudentRangeEstimate } from "@prisma/client";

/// Plano sugerido pela faixa de alunos (FIT-166, usado também no cadastro
/// mínimo da EPIC-33): o menor que comporta a faixa.
const RANGE_MAX: Record<PersonalStudentRangeEstimate, number | null> = { COMECANDO_AGORA: 20, ATE_20: 20, DE_21_A_50: 50, MAIS_DE_50: null };

export function suggestPlan<T extends { studentLimit: number | null; priceCents: number }>(plans: T[], range: PersonalStudentRangeEstimate | null): T | null {
  if (plans.length === 0) return null;
  const max = range ? RANGE_MAX[range] : 20;
  const fits = plans.filter((plan) => plan.studentLimit === null || (max !== null && plan.studentLimit >= max));
  const sorted = [...(fits.length > 0 ? fits : plans)].sort((a, b) => (a.studentLimit ?? Infinity) - (b.studentLimit ?? Infinity) || a.priceCents - b.priceCents);
  return sorted[0] ?? null;
}
