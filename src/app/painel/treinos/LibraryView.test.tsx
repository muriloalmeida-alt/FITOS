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

  it("no FitOS Livre, usar um treino copia para Meus treinos e oferece começar agora", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ workoutIds: ["w1"] }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<LibraryView mode="livre" tab="treinos" students={[]} entries={{ programas: [], treinos: [entry("Corpo todo · 30 min", 30)], aerobicos: [] }} />);

    expect(screen.getByRole("link", { name: "Treinos" })).toHaveAttribute("href", "/painel/meus-treinos/biblioteca?aba=treinos");
    expect(screen.getByRole("link", { name: "Montar meu treino" })).toHaveAttribute("href", "/painel/meus-treinos/novo");
    await userEvent.click(screen.getByRole("button", { name: /Corpo todo · 30 min/ }));
    expect(screen.queryByText("Aplicar para")).toBeNull();
    expect(screen.queryByRole("link", { name: "Editar modelo" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Usar este treino" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/livre/biblioteca", expect.objectContaining({ body: JSON.stringify({ kind: "treino", key: "Corpo todo · 30 min" }) }));
    expect(await screen.findByRole("dialog", { name: "Está nos seus treinos" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Começar agora" })).toHaveAttribute("href", "/painel/meus-treinos/sessao?treino=w1");
    vi.unstubAllGlobals();
  });

  it("no FitOS Livre, o programa avisa que os treinos atuais vão para Arquivados", async () => {
    render(<LibraryView mode="livre" tab="programas" students={[]} entries={{ programas: [{ ...entry("Divisão ABC · 60 min", 60), minutes: null, meta: "2 treinos + 1 aeróbico · 8 semanas" }], treinos: [], aerobicos: [] }} />);
    await userEvent.click(screen.getByRole("button", { name: /Divisão ABC/ }));
    expect(screen.getByText(/Seus treinos atuais vão para Arquivados/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Começar este programa" })).toBeInTheDocument();
  });
});
