import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const nav = vi.hoisted(() => ({ push: vi.fn(), pathname: "/painel" }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: nav.push }), usePathname: () => nav.pathname }));

import { QuickAccess } from "./QuickAccess";

const actions = [
  { key: "comecar", label: "Começar treino", href: "/painel/treino/sessao", icon: "inicio" },
  { key: "programa", label: "Meus treinos", href: "/painel/treino", icon: "treinos" },
];

describe("QuickAccess", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    nav.pathname = "/painel";
  });

  it("abre a modal sem título visível, esconde o + e navega fechando a modal", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ actions }), { status: 200 }));
    render(<QuickAccess />);
    const plus = screen.getByRole("button", { name: "Abrir ações" });
    expect(plus).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(plus);
    const dialog = screen.getByRole("dialog", { name: "Ações disponíveis" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Abrir ações" })).not.toBeInTheDocument();
    expect(await screen.findAllByRole("button", { name: /Começar treino|Meus treinos/ })).toHaveLength(2);
    await userEvent.click(screen.getByRole("button", { name: "Começar treino" }));
    expect(nav.push).toHaveBeenCalledWith("/painel/treino/sessao");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("fecha por × e Escape, devolvendo o foco ao +; falha mostra tentar de novo", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("{}", { status: 500 })).mockResolvedValue(new Response(JSON.stringify({ actions }), { status: 200 }));
    render(<QuickAccess />);
    await userEvent.click(screen.getByRole("button", { name: "Abrir ações" }));
    await userEvent.click(await screen.findByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByRole("button", { name: "Meus treinos" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Fechar" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Abrir ações" })).toHaveFocus());
    await userEvent.click(screen.getByRole("button", { name: "Abrir ações" }));
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.getByRole("button", { name: "Abrir ações" })).toHaveFocus());
  });

  it("não aparece no treino ao vivo", () => {
    nav.pathname = "/painel/treino/sessao";
    render(<QuickAccess />);
    expect(screen.queryByRole("button", { name: "Abrir ações" })).not.toBeInTheDocument();
  });
});
