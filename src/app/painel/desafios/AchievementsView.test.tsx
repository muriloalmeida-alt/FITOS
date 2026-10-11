import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AchievementsView } from "./AchievementsView";
import type { PeriodSummary } from "@/modules/gamification/achievements";

const period = (over: Partial<PeriodSummary>): PeriodSummary => ({
  type: "SEMANA",
  key: "2026-10-05",
  startsAt: new Date("2026-10-05T03:00:00Z"),
  endsAt: new Date("2026-10-12T03:00:00Z"),
  goalTenths: 1800,
  pointsTenths: 1350,
  medal: "PRATA",
  next: { label: "Ouro", missingTenths: 450, thresholdTenths: 1800 },
  plannedDays: 3,
  itemsPerWorkout: 6,
  ...over,
});

describe("AchievementsView (Conquistas)", () => {
  it("medalha atual, quanto falta, como a meta é feita, faixas e galeria", () => {
    render(
      <AchievementsView
        achievements={{
          week: period({}),
          month: period({ type: "MES", key: "2026-10", startsAt: new Date("2026-10-01T03:00:00Z"), endsAt: new Date("2026-11-01T03:00:00Z"), goalTenths: 7800, pointsTenths: 1350, medal: null, next: { label: "Bronze", missingTenths: 2550, thresholdTenths: 3900 }, plannedDays: 13 }),
          weeks: [period({ key: "2026-09-28", startsAt: new Date("2026-09-28T03:00:00Z"), endsAt: new Date("2026-10-05T03:00:00Z"), pointsTenths: 2000, medal: "PLATINA", next: null })],
          months: [],
          pendingPhotos: 2,
        }}
      />
    );
    expect(screen.getByText("2 treinos desta semana esperam foto", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Prata · Ritmo firme" })).toBeInTheDocument();
    expect(screen.getByText("135/180 pontos")).toBeInTheDocument();
    expect(screen.getByText(/faltam 45 para Ouro/)).toBeInTheDocument();
    expect(screen.getByText("Meta: 3 treinos × 6 exercícios × 10 pontos.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Rumo ao Bronze" })).toBeInTheDocument();
    expect(screen.getByText("Semana 28/09 a 04/10")).toBeInTheDocument();
    expect(screen.getByText("200/180 pontos · Platina")).toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: /Medalha/ }).length).toBeGreaterThan(4);
  });
});
