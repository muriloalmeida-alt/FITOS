/// Rótulo da dificuldade do catálogo curado ("iniciante" → "Iniciante").
const LABELS: Record<string, string> = { iniciante: "Iniciante", intermediario: "Intermediário", avancado: "Avançado" };

export function difficultyLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return LABELS[value.toLowerCase()] ?? value;
}
