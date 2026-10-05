import { describe, expect, it } from "vitest";
import { titleFit } from "./titleFit";

describe("titleFit", () => {
  it("desce a fonte conforme o tamanho do título", () => {
    expect(titleFit("Sua biblioteca")).toBe("base");
    expect(titleFit("Hipertrofia 8 semanas")).toBe("small");
    expect(titleFit("Programa Treino A — Inferiores")).toBe("tiny");
  });
});
