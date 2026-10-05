/// Aeróbicos (EPIC-28, ADR-016). Um item aeróbico é um exercício do tipo
/// "Aeróbico" prescrito por tempo e intensidade, sem séries nem repetições.

export type CardioIntensity = "LEVE" | "MODERADO" | "FORTE" | "INTERVALADO";

export const CARDIO_TYPE = "Aeróbico";
export const CARDIO_INTENSITIES: CardioIntensity[] = ["LEVE", "MODERADO", "FORTE", "INTERVALADO"];
export const CARDIO_INTENSITY_LABELS: Record<CardioIntensity, string> = {
  LEVE: "Leve",
  MODERADO: "Moderado",
  FORTE: "Forte",
  INTERVALADO: "Intervalado",
};
export const DEFAULT_CARDIO = { durationSeconds: 20 * 60, intensity: "MODERADO" as CardioIntensity };
export const CARDIO_STEP_SECONDS = 5 * 60;
export const CARDIO_MIN_SECONDS = 5 * 60;
export const CARDIO_MAX_SECONDS = 180 * 60;

export function isCardioType(type: string | null | undefined): boolean {
  return type === CARDIO_TYPE;
}

export function nextIntensity(current: CardioIntensity | null): CardioIntensity {
  const index = current ? CARDIO_INTENSITIES.indexOf(current) : -1;
  return CARDIO_INTENSITIES[(index + 1) % CARDIO_INTENSITIES.length]!;
}

/// "20 min · moderado".
export function cardioLine(durationSeconds: number | null, intensity: CardioIntensity | null): string {
  const parts: string[] = [];
  if (durationSeconds) parts.push(`${Math.round(durationSeconds / 60)} min`);
  if (intensity) parts.push(CARDIO_INTENSITY_LABELS[intensity].toLowerCase());
  return parts.length > 0 ? parts.join(" · ") : "Sem prescrição";
}

export interface CardioPhase {
  label: string;
  cue: string;
  seconds: number;
  kind: "calm" | "steady" | "hard";
}

const CUES: Record<Exclude<CardioIntensity, "INTERVALADO">, string> = {
  LEVE: "Ritmo confortável, dá para conversar",
  MODERADO: "Respiração acelerada, frases curtas",
  FORTE: "Ritmo alto, poucas palavras",
};

/// Etapas do aeróbico ao vivo. Contínuo: aquecimento, ritmo e
/// desaquecimento. Intervalado: aquecimento, tiros de 30 s com 90 s de
/// recuperação e desaquecimento. A soma é sempre o tempo prescrito.
export function cardioPhases(durationSeconds: number, intensity: CardioIntensity): CardioPhase[] {
  const total = Math.max(CARDIO_MIN_SECONDS, durationSeconds);
  const warm = total >= 15 * 60 ? 5 * 60 : 2 * 60;
  const cool = total >= 15 * 60 ? 3 * 60 : 60;
  const main = total - warm - cool;
  const phases: CardioPhase[] = [{ label: "Aquecimento", cue: "Bem leve, solte o corpo", seconds: warm, kind: "calm" }];
  if (intensity === "INTERVALADO") {
    const rounds = Math.max(1, Math.floor(main / 120));
    for (let round = 1; round <= rounds; round += 1) {
      phases.push({ label: `Tiro ${round} de ${rounds}`, cue: "Forte, o máximo que aguentar", seconds: 30, kind: "hard" });
      phases.push({ label: "Recuperação", cue: "Leve, respire", seconds: 90, kind: "calm" });
    }
    const leftover = main - rounds * 120;
    phases.push({ label: "Desaquecimento", cue: "Bem leve", seconds: cool + leftover, kind: "calm" });
    return phases;
  }
  phases.push({ label: "Ritmo", cue: CUES[intensity], seconds: main, kind: intensity === "FORTE" ? "hard" : "steady" });
  phases.push({ label: "Desaquecimento", cue: "Bem leve", seconds: cool, kind: "calm" });
  return phases;
}
