/// Prescrição em uma linha curta (FIT-152, FIT-153): "3 × 12 · 20 kg ·
/// 60 s de descanso" ou "3 × 45 s". Nunca inventa um valor ausente.
import { cardioLine, type CardioIntensity } from "./cardio";

export interface PrescriptionInput {
  /// Item aeróbico: tempo e intensidade, sem séries (EPIC-28).
  intensity?: CardioIntensity | null;
  sets: number | null;
  reps: number | null;
  durationSeconds: number | null;
  load: string | null;
  restSeconds: number | null;
}

export function prescriptionLine(item: PrescriptionInput): string {
  if (item.intensity) return cardioLine(item.durationSeconds, item.intensity);
  const parts: string[] = [];
  const amount = item.durationSeconds ? `${item.durationSeconds} s` : item.reps ? String(item.reps) : null;
  if (item.sets && amount) parts.push(`${item.sets} × ${amount}`);
  else if (item.sets) parts.push(`${item.sets} ${item.sets === 1 ? "série" : "séries"}`);
  else if (amount) parts.push(amount);
  if (item.load) parts.push(item.load);
  if (item.restSeconds) parts.push(`${item.restSeconds} s de descanso`);
  return parts.length > 0 ? parts.join(" · ") : "Sem prescrição";
}
