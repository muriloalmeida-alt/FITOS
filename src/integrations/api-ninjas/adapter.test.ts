import { describe, expect, it } from "vitest";
import { toExerciseDTO } from "./adapter";
import { ApiNinjasError } from "./errors";

describe("toExerciseDTO (FIT-020)", () => {
  it("preserva o texto original de todos os campos presentes", () => {
    const dto = toExerciseDTO({
      name: "  Barbell Squat  ",
      type: "strength",
      muscle: "quadriceps",
      equipments: "barbell",
      difficulty: "intermediate",
      instructions: "Stand with feet shoulder-width apart...",
      safety_info: "Keep your back straight.",
    });

    expect(dto).toEqual({
      name: "Barbell Squat",
      type: "strength",
      muscle: "quadriceps",
      equipments: "barbell",
      difficulty: "intermediate",
      instructions: "Stand with feet shoulder-width apart...",
      safetyInfo: "Keep your back straight.",
    });
  });

  it("campos ausentes tornam-se null, nunca string vazia ou undefined", () => {
    const dto = toExerciseDTO({ name: "Push-up" });

    expect(dto.type).toBeNull();
    expect(dto.muscle).toBeNull();
    expect(dto.equipments).toBeNull();
    expect(dto.difficulty).toBeNull();
    expect(dto.instructions).toBeNull();
    expect(dto.safetyInfo).toBeNull();
  });

  it("campo presente mas em branco também se torna null", () => {
    const dto = toExerciseDTO({ name: "Push-up", muscle: "   " });
    expect(dto.muscle).toBeNull();
  });

  it("nome ausente: RESPOSTA_INVALIDA", () => {
    expect(() => toExerciseDTO({ name: "" })).toThrow(ApiNinjasError);
    expect(() => toExerciseDTO({} as never)).toThrow(ApiNinjasError);
  });
});
