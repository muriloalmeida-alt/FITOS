import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ToastProvider } from "@/shared/ui";
import { MonthlyReportView, type MonthlyReportData } from "./MonthlyReportView";

const report: MonthlyReportData = {
  label: "Setembro de 2026",
  sessions: 12,
  days: 11,
  activeMinutes: 540,
  sets: 180,
  volumeKg: 24350,
  previous: { sessions: 9, volumeKg: 20000 },
  records: [{ exerciseName: "Supino reto", loadKg: 47.5 }],
  gains: [{ exerciseName: "Supino reto", fromKg: 40, toKg: 47.5 }],
  body: { weightFrom: 82, weightTo: 80.5, fatFrom: 22, fatTo: 20.5 },
  photos: [{ id: "f1", pose: "FRENTE", takenIso: "2026-09-02T12:00:00Z" }],
};

describe("relatório do mês (EPIC-45)", () => {
  it("mostra números, comparação, recordes, corpo e fotos", () => {
    render(
      <ToastProvider>
        <MonthlyReportView report={report} name="Ana" prevHref="/painel/relatorio?mes=2026-08" nextHref={null} />
      </ToastProvider>
    );
    expect(screen.getByText("Setembro de 2026")).toBeInTheDocument();
    expect(screen.getByText("+3 que o mês anterior")).toBeInTheDocument();
    expect(screen.getByText("24.350")).toBeInTheDocument();
    expect(screen.getByText("+4.350 kg que o mês anterior")).toBeInTheDocument();
    expect(screen.getByText("9 h")).toBeInTheDocument();
    expect(screen.getByText("Peso: 82 → 80,5 kg (−1,5)")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mês anterior" })).toHaveAttribute("href", "/painel/relatorio?mes=2026-08");
    expect(screen.queryByRole("link", { name: "Próximo mês" })).toBeNull();
    expect(screen.getByAltText(/Foto de/)).toHaveAttribute("src", "/api/fotos-evolucao/f1");
    expect(screen.getByRole("button", { name: "Compartilhar o mês" })).toBeInTheDocument();
  });

  it("mês vazio", () => {
    render(
      <ToastProvider>
        <MonthlyReportView report={{ ...report, sessions: 0, days: 0, records: [], gains: [], body: null, photos: [] }} name="Ana" prevHref={null} nextHref={null} />
      </ToastProvider>
    );
    expect(screen.getByText("Nenhum treino neste mês.")).toBeInTheDocument();
  });
});
