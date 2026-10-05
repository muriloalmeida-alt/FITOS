/// Carga prescrita (`WorkoutExercise.load` é texto livre desde a FIT-030).
/// O editor sem formulário (FIT-146) trabalha com quilos e +/−: "40 kg",
/// "40", "42,5kg" viram número; texto que não é número (ex.: "moderada")
/// fica `null` e é mostrado como está, sem perder o que o personal
/// escreveu antes.
export function parseLoadKg(load: string | null | undefined): number | null {
  if (!load) return 0;
  const match = load.trim().match(/^(\d+(?:[.,]\d+)?)\s*(?:kg)?$/i);
  if (!match) return null;
  return Number(match[1]!.replace(",", "."));
}

/// Número de quilos → texto persistido. Zero vira carga livre (`null`).
export function formatLoadForStorage(kg: number): string | null {
  if (kg <= 0) return null;
  return `${String(kg).replace(".", ",")} kg`;
}

/// Texto curto para exibir no controle: "Livre" ou "40 kg".
export function formatLoadLabel(kg: number): string {
  return kg <= 0 ? "Livre" : `${String(kg).replace(".", ",")} kg`;
}
