import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JoinByLinkForm } from "./JoinByLinkForm";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
afterEach(() => vi.restoreAllMocks());

describe("Entrar pelo link (EPIC-29)", () => {
  it("valida, envia nome, e-mail e senha e leva ao Início", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response("{}", { status: 201 }));
    render(<JoinByLinkForm code="abc23456" />);
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(screen.getByText("Informe seu nome.")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Seu nome"), "Gabriel Nunes");
    await userEvent.type(screen.getByLabelText("E-mail"), "gabriel@ex.test");
    await userEvent.type(screen.getByLabelText("Crie uma senha"), "senha-forte-123");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/convite-link/abc23456", expect.objectContaining({ body: JSON.stringify({ name: "Gabriel Nunes", email: "gabriel@ex.test", password: "senha-forte-123" }) }));
    expect(push).toHaveBeenCalledWith("/painel");
  });
});
