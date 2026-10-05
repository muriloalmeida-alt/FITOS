import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LibraryView, durationBucket, type LibraryViewEntry } from "./LibraryView";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const entry = (name: string, minutes: number): LibraryViewEntry => ({ id: name, name, meta: `cerca de ${minutes} min`, thumbnails: [], cardio: false, minutes, lines: [] });

describe("Biblioteca por tempo (EPIC-32)", () => {
  it("faixas de 30, 45 e 60 min", () => {
    expect([25, 30, 37, 40, 45, 52, 55, 60, 75].map(durationBucket)).toEqual([30, 30, 30, 45, 45, 45, 60, 60, 60]);
  });

  it("filtra os treinos pelo tempo por dia", async () => {
    render(
      <LibraryView
        tab="treinos"
        students={[]}
        entries={{ programas: [], treinos: [entry("Corpo todo · 30 min", 30), entry("Corpo todo · 45 min", 45), entry("Pernas completo · 60 min", 60)], aerobicos: [] }}
      />
    );
    const list = () => screen.getByRole("list", { name: "Treinos" });
    expect(within(list()).getAllByRole("listitem")).toHaveLength(3);
    await userEvent.click(screen.getByRole("radio", { name: "45 min" }));
    expect(within(list()).getAllByRole("listitem").map((item) => item.textContent)).toEqual([expect.stringContaining("Corpo todo · 45 min")]);
    await userEvent.click(screen.getByRole("radio", { name: "Todos" }));
    expect(within(list()).getAllByRole("listitem")).toHaveLength(3);
  });
});
