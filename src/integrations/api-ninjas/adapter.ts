import { ApiNinjasError } from "./errors";
import type { ApiNinjasExerciseRaw, ExerciseDTO } from "./types";

/// Normaliza uma string opcional: `undefined`/string vazia (só espaços)
/// tornam-se `null`; caso contrário, preserva o texto original (nunca
/// traduz, nunca reformata além de remover espaços nas pontas).
function toNullableText(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/// Converte um item bruto da API Ninjas no DTO interno do FitOS. Lança
/// `RESPOSTA_INVALIDA` quando o item não tem o mínimo exigível para ser
/// útil (nome não-vazio) — nunca aceita silenciosamente um item sem nome.
export function toExerciseDTO(raw: ApiNinjasExerciseRaw): ExerciseDTO {
  if (typeof raw.name !== "string" || raw.name.trim().length === 0) {
    throw new ApiNinjasError("RESPOSTA_INVALIDA", "Item recebido sem nome válido.");
  }

  return {
    name: raw.name.trim(),
    type: toNullableText(raw.type),
    muscle: toNullableText(raw.muscle),
    equipments: toNullableText(raw.equipments),
    difficulty: toNullableText(raw.difficulty),
    instructions: toNullableText(raw.instructions),
    safetyInfo: toNullableText(raw.safety_info),
  };
}
