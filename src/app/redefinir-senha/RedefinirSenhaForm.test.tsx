import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const resetPassword = vi.fn();
let token: string | null = "tok123";
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(token ? { token } : {}) }));
vi.mock("@/modules/identity/auth-client", () => ({ authClient: { resetPassword: (...args: unknown[]) => resetPassword(...args) } }));
const { RedefinirSenhaForm } = await import("./RedefinirSenhaForm");

describe("RedefinirSenhaForm (EPIC-24)", () => {
  beforeEach(() => {
    resetPassword.mockReset();
    token = "tok123";
  });

  it("sem token: oferece pedir outro link", () => {
    token = null;
    render(<RedefinirSenhaForm />);
    expect(screen.getByRole("link", { name: "Pedir novo link" }).getAttribute("href")).toBe("/esqueci-senha");
  });

  it("exige 8 caracteres e salva a senha nova", async () => {
    resetPassword.mockResolvedValue({ data: { status: true }, error: null });
    render(<RedefinirSenhaForm />);
    await userEvent.type(screen.getByLabelText("Nova senha"), "curta");
    await userEvent.click(screen.getByRole("button", { name: "Salvar nova senha" }));
    expect(screen.getByText("Use pelo menos 8 caracteres.")).toBeTruthy();
    await userEvent.type(screen.getByLabelText("Nova senha"), "-mais-longa");
    await userEvent.click(screen.getByRole("button", { name: "Salvar nova senha" }));
    expect(resetPassword).toHaveBeenCalledWith({ newPassword: "curta-mais-longa", token: "tok123" });
    expect(screen.getByRole("status").textContent).toContain("Senha nova salva");
  });

  it("link vencido ou já usado", async () => {
    resetPassword.mockResolvedValue({ data: null, error: { status: 400, code: "INVALID_TOKEN" } });
    render(<RedefinirSenhaForm />);
    await userEvent.type(screen.getByLabelText("Nova senha"), "senha-nova-123");
    await userEvent.click(screen.getByRole("button", { name: "Salvar nova senha" }));
    expect(screen.getByRole("alert").textContent).toContain("Este link venceu ou já foi usado");
  });
});
