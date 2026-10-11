import { describe, expect, it } from "vitest";
import { balancedTenths, blockPointsTenths, blockSecondsDone, cardioPointsTenths, doneFor, formatPoints, isIsometric, isometricPointsTenths, kindFor, strengthPointsTenths } from "./scoring";

const KG = 1000;
/// Volume (gramas·repetição) de séries iguais.
const volume = (sets: number, reps: number, kg: number) => sets * reps * kg * KG;

describe("musculação: volume registrado (PDF 3, seção 02)", () => {
  const reference = volume(3, 10, 30); // 900 kg
  it.each([
    [810, 90],
    [900, 100],
    [945, 100],
    [990, 110],
    [1080, 120],
    [1170, 130],
  ])("%d kg → %d décimos", (kg, tenths) => {
    expect(strengthPointsTenths(kg * KG, reference)).toBe(tenths);
  });

  it("cargas distintas série a série somam; teto 20; sem referência, zero", () => {
    const sets = [
      { reps: 10, loadGrams: 30 * KG, durationSeconds: null },
      { reps: 10, loadGrams: 32 * KG, durationSeconds: null },
      { reps: 8, loadGrams: 35 * KG, durationSeconds: null },
    ];
    expect(doneFor("VOLUME", sets)).toBe((300 + 320 + 280) * KG);
    expect(strengthPointsTenths(doneFor("VOLUME", sets), reference)).toBe(100);
    expect(strengthPointsTenths(reference * 5, reference)).toBe(200);
    expect(strengthPointsTenths(reference, 0)).toBe(0);
    expect(strengthPointsTenths(0, reference)).toBe(0);
  });

  it("sem carga: repetições × séries", () => {
    const sets = [1, 2, 3].map(() => ({ reps: 12, loadGrams: null, durationSeconds: null }));
    expect(kindFor(false, sets)).toBe("REPETICOES");
    expect(strengthPointsTenths(doneFor("REPETICOES", sets), 30)).toBe(120);
    expect(kindFor(false, [{ reps: 10, loadGrams: 20 * KG, durationSeconds: null }])).toBe("VOLUME");
    expect(kindFor(true, sets)).toBe("TEMPO");
  });
});

describe("aeróbico: tempo efetivo (PDF 3, seção 03)", () => {
  it.each([
    [15, 50],
    [20, 67],
    [30, 100],
    [39, 100],
    [40, 110],
    [50, 120],
    [60, 130],
  ])("%d min → %d décimos", (minutes, tenths) => {
    expect(cardioPointsTenths(minutes * 60)).toBe(tenths);
  });

  it("teto 15; referência própria", () => {
    expect(cardioPointsTenths(200 * 60)).toBe(150);
    expect(cardioPointsTenths(20 * 60, 20 * 60)).toBe(100);
  });
});

describe("treino: total e equilibrado (PDF 3, seção 04)", () => {
  it("42 pontos em 4 itens = 10,5; item não feito conta zero no denominador", () => {
    expect(balancedTenths(420, 4)).toBe(105);
    expect(balancedTenths(420, 5)).toBe(84);
    expect(balancedTenths(420, 0)).toBe(0);
    expect(formatPoints(105)).toBe("10,5");
    expect(formatPoints(420)).toBe("42");
  });
});

describe("regra 2: isometria e blocos (Funcional)", () => {
  it("isometria: só tempo, sem repetições nem carga; 1 ponto por 30 s com teto de 20", () => {
    expect(isIsometric(false, [{ reps: null, loadGrams: null, durationSeconds: 60 }])).toBe(true);
    expect(isIsometric(false, [{ reps: 10, loadGrams: null, durationSeconds: null }])).toBe(false);
    expect(isIsometric(true, [{ reps: null, loadGrams: null, durationSeconds: 600 }])).toBe(false);
    expect(isometricPointsTenths(180)).toBe(60);
    expect(isometricPointsTenths(45)).toBe(15);
    expect(isometricPointsTenths(3600)).toBe(200);
  });

  it("bloco: 1 ponto por minuto, proporcional, teto de 30", () => {
    expect(blockPointsTenths(580)).toBe(96);
    expect(blockPointsTenths(600)).toBe(100);
    expect(blockPointsTenths(60 * 60)).toBe(300);
    expect(blockPointsTenths(0)).toBe(0);
  });

  it("minutos feitos por formato", () => {
    const base = { windowSeconds: null, intervals: null, intervalSeconds: null, timeCapSeconds: null };
    const none = { outcome: null, roundsCompleted: null, partialReps: null, intervalsCompleted: null, elapsedSeconds: null };
    expect(blockSecondsDone({ ...base, kind: "EMOM", intervals: 10, intervalSeconds: 60 }, { ...none, intervalsCompleted: 8 }, 0)).toBe(480);
    expect(blockSecondsDone({ ...base, kind: "AMRAP", windowSeconds: 720 }, { ...none, roundsCompleted: 5 }, 0)).toBe(720);
    expect(blockSecondsDone({ ...base, kind: "AMRAP", windowSeconds: 720 }, { ...none, roundsCompleted: 5 }, 400)).toBe(400);
    expect(blockSecondsDone({ ...base, kind: "AMRAP", windowSeconds: 720 }, none, 720)).toBe(0);
    expect(blockSecondsDone({ ...base, kind: "FOR_TIME", timeCapSeconds: 900 }, { ...none, outcome: "CONCLUIDO", elapsedSeconds: 580 }, 0)).toBe(580);
    expect(blockSecondsDone({ ...base, kind: "FOR_TIME", timeCapSeconds: 900 }, { ...none, outcome: "LIMITE_ATINGIDO" }, 950)).toBe(900);
    expect(blockSecondsDone({ ...base, kind: "FOR_TIME", timeCapSeconds: 900 }, { ...none, outcome: "PARCIAL" }, 0)).toBe(0);
    expect(blockSecondsDone({ ...base, kind: "CIRCUITO" }, { ...none, roundsCompleted: 3 }, 840)).toBe(840);
  });
});
