import { describe, expect, it } from "vitest";
import { sessionBadges } from "./sessionBadges";

describe("etiquetas do treino no histórico", () => {
  it("registrado e situação dos pontos", () => {
    expect(sessionBadges({ mode: "LIVE", points: null })).toEqual([]);
    expect(sessionBadges({ mode: "RETROATIVO", points: { totalTenths: 0, status: "PENDENTE_FOTO" } })).toEqual([
      { label: "Registrado", tone: "muted" },
      { label: "Salvo sem pontuação", tone: "warn" },
    ]);
    expect(sessionBadges({ mode: "LIVE", points: { totalTenths: 105, status: "LIBERADO" } }).map((badge) => badge.label)).toEqual(["10,5 pontos"]);
    expect(sessionBadges({ mode: "LIVE", points: { totalTenths: 100, status: "CONTESTADO" } }).map((badge) => badge.label)).toEqual(["Em contestação"]);
    expect(sessionBadges({ mode: "LIVE", points: { totalTenths: 100, status: "ANULADO" } }).map((badge) => badge.label)).toEqual(["Pontos anulados"]);
  });
});
