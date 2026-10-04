import { describe, expect, it } from "vitest";
import { formatLoadForStorage, formatLoadLabel, parseLoadKg } from "./load";
import { formatDays, weekStripFromDays } from "./weekdays";

describe("weekdays", () => {
  it("formata dias na ordem da semana", () => {
    expect(formatDays(["QUINTA", "SEGUNDA"])).toBe("Seg, Qui");
    expect(formatDays([])).toBe("sem dia definido");
  });

  it("monta a faixa da semana com previsto, feito e hoje", () => {
    const strip = weekStripFromDays(["SEGUNDA", "QUARTA"], { done: [true, false, false, false, false, false, false], today: new Date(2026, 9, 7) });
    expect(strip.map((d) => d.state)).toEqual(["done", "rest", "planned", "rest", "rest", "rest", "rest"]);
    expect(strip[2]!.today).toBe(true);
  });
});

describe("load", () => {
  it("entende quilos em vários formatos e preserva texto livre", () => {
    expect(parseLoadKg("40 kg")).toBe(40);
    expect(parseLoadKg("42,5kg")).toBe(42.5);
    expect(parseLoadKg("12")).toBe(12);
    expect(parseLoadKg(null)).toBe(0);
    expect(parseLoadKg("moderada")).toBeNull();
  });

  it("guarda e mostra quilos; zero é carga livre", () => {
    expect(formatLoadForStorage(42.5)).toBe("42,5 kg");
    expect(formatLoadForStorage(0)).toBeNull();
    expect(formatLoadLabel(0)).toBe("Livre");
    expect(formatLoadLabel(7.5)).toBe("7,5 kg");
  });
});
