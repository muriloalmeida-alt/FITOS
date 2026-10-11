import { describe, expect, it } from "vitest";
import type { LiveItem } from "./LiveWorkout";
import { fitToMinutes, shortOptions, workoutMinutes } from "./shortWorkout";

const strength = (id: string, sets = 4): LiveItem => ({ id, exerciseId: `ex-${id}`, name: id, imageUrl: null, imageAlt: null, instructions: null, sets, reps: 10, durationSeconds: null, loadKg: null, load: null, restSeconds: 60, notes: null, intensity: null, doneSets: [], last: null });
const cardio = (id: string, minutes: number): LiveItem => ({ ...strength(id, 1), sets: null, reps: null, durationSeconds: minutes * 60, restSeconds: null, intensity: "MODERADO" });

describe("só tenho X min (EPIC-38)", () => {
  // 6 exercícios × 4 séries × 100 s = 40 min + 15 min de bike = 55 min.
  const workout = [strength("Agachamento"), strength("Leg press"), strength("Cadeira"), strength("Mesa"), strength("Elevação"), strength("Panturrilha"), cardio("Bike", 15)];

  it("estima o treino e oferece só versões menores", () => {
    expect(workoutMinutes(workout)).toBe(55);
    expect(shortOptions(workout)).toEqual([20, 30, 45]);
    expect(shortOptions([strength("A", 3)])).toEqual([]);
  });

  it("45 min: corta para 2 séries e mantém todos os exercícios", () => {
    const plan = fitToMinutes(workout, 45);
    expect(plan.items.filter((item) => !item.intensity).every((item) => item.sets === 2)).toBe(true);
    expect(plan.dropped).toEqual([]);
    expect(plan.setsCut).toBe(true);
    expect(workoutMinutes(plan.items)).toBeLessThanOrEqual(45);
  });

  it("30 min: encurta o aeróbico antes de tirar exercícios", () => {
    const plan = fitToMinutes(workout, 30);
    expect(plan.cardioCut).toBe(true);
    expect(plan.items.find((item) => item.id === "Bike")!.durationSeconds).toBe(10 * 60);
    expect(plan.dropped).toEqual([]);
    expect(workoutMinutes(plan.items)).toBeLessThanOrEqual(30);
  });

  it("20 min: deixa os últimos para outro dia, ficando ao menos 2", () => {
    const plan = fitToMinutes(workout, 20);
    const kept = plan.items.filter((item) => !plan.dropped.includes(item.id));
    expect(plan.dropped).toEqual(["Bike"]);
    expect(plan.cardioCut).toBe(false);
    expect(workoutMinutes(kept)).toBeLessThanOrEqual(20);
    expect(fitToMinutes([strength("A"), strength("B")], 5).dropped).toEqual([]);
  });
});
