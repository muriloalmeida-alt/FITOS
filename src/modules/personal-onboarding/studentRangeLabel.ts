import type { PersonalStudentRangeEstimate } from "@prisma/client";

export const STUDENT_RANGE_OPTIONS: { value: PersonalStudentRangeEstimate; label: string }[] = [
  { value: "COMECANDO_AGORA", label: "Começando agora" },
  { value: "ATE_20", label: "Até 20 alunos" },
  { value: "DE_21_A_50", label: "De 21 a 50 alunos" },
  { value: "MAIS_DE_50", label: "Mais de 50 alunos" },
];

export function studentRangeLabel(value: PersonalStudentRangeEstimate | ""): string {
  return STUDENT_RANGE_OPTIONS.find((option) => option.value === value)?.label ?? "—";
}
