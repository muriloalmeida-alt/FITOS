import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const nav = vi.hoisted(() => ({ replace: vi.fn(), params: "" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: nav.replace, refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => "/painel/exercicios",
  useSearchParams: () => new URLSearchParams(nav.params),
}));
vi.mock("./ExerciseForm", () => ({ ExerciseFormSheet: () => null }));

import { LibraryControls, activeFilterCount } from "./LibraryControls";

function renderControls() {
  render(<LibraryControls muscles={["Costas", "Peito"]} types={["Peso corporal"]} difficulties={["INICIANTE"]} categories={["Musculação", "Funcional"]} openCreate={false} />);
}

describe("busca e filtros da biblioteca (proposta 8)", () => {
  afterEach(() => {
    nav.replace.mockReset();
    nav.params = "";
    delete document.body.dataset.keyboard;
  });

  it("contador só com grupos diferentes de Todos; a busca não conta", () => {
    expect(activeFilterCount({ origem: null, categoria: "Funcional", musculo: "Costas", tipo: null, dificuldade: null })).toBe(2);
    nav.params = "q=remada&categoria=Funcional&musculo=Costas";
    renderControls();
    expect(screen.getByRole("button", { name: "Filtrar exercícios, 2 ativos" })).toBeInTheDocument();
    const chips = screen.getByRole("list", { name: "Filtros aplicados" });
    expect(within(chips).getAllByRole("listitem").map((item) => item.textContent)).toEqual(["Funcional×", "Costas×"]);
  });

  it("remover um chip mantém os demais e a busca", async () => {
    nav.params = "q=remada&categoria=Funcional&musculo=Costas";
    renderControls();
    await userEvent.click(screen.getByRole("button", { name: "Remover filtro Costas" }));
    expect(nav.replace).toHaveBeenCalledWith("/painel/exercicios?q=remada&categoria=Funcional", { scroll: false });
  });

  it("modal com rascunho: fechar descarta, Ver resultados aplica, Limpar volta ao padrão", async () => {
    nav.params = "musculo=Peito";
    renderControls();
    await userEvent.click(screen.getByRole("button", { name: /Filtrar exercícios/ }));
    let dialog = screen.getByRole("dialog", { name: "Filtrar exercícios" });
    await userEvent.click(within(dialog).getByRole("radio", { name: "Costas" }));
    await userEvent.keyboard("{Escape}");
    expect(nav.replace).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: /Filtrar exercícios/ }));
    dialog = screen.getByRole("dialog", { name: "Filtrar exercícios" });
    // O rascunho reabre com o aplicado.
    expect(within(dialog).getByRole("radio", { name: "Peito" })).toHaveAttribute("aria-checked", "true");
    await userEvent.click(within(dialog).getByRole("radio", { name: "Biblioteca FitOS" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Ver resultados" }));
    expect(nav.replace).toHaveBeenLastCalledWith("/painel/exercicios?musculo=Peito&origem=biblioteca", { scroll: false });

    await userEvent.click(screen.getByRole("button", { name: /Filtrar exercícios/ }));
    dialog = screen.getByRole("dialog", { name: "Filtrar exercícios" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Limpar" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Ver resultados" }));
    expect(nav.replace).toHaveBeenLastCalledWith("/painel/exercicios", { scroll: false });
  });

  it("busca com debounce sem perder o foco; × limpa só o texto; Concluir busca fecha o teclado", async () => {
    nav.params = "musculo=Costas";
    renderControls();
    const search = screen.getByRole("searchbox", { name: "Buscar exercício" });
    await userEvent.click(search);
    expect(document.body.dataset.keyboard).toBe("open");
    await userEvent.type(search, "remada");
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/painel/exercicios?musculo=Costas&q=remada", { scroll: false }));
    expect(search).toHaveFocus();
    await userEvent.click(screen.getByRole("button", { name: "Limpar busca" }));
    expect(search).toHaveValue("");
    await userEvent.click(screen.getByRole("button", { name: "Concluir busca" }));
    expect(search).not.toHaveFocus();
    expect(document.body.dataset.keyboard).toBeUndefined();
    expect(screen.getByRole("button", { name: /Filtrar exercícios/ })).toBeInTheDocument();
  });
});
