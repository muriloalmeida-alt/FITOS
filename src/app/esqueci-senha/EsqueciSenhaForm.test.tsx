import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const requestPasswordReset = vi.fn();
vi.mock("@/modules/identity/auth-client", () => ({ authClient: { requestPasswordReset: (...args: unknown[]) => requestPasswordReset(...args) } }));
const { EsqueciSenhaForm } = await import("./EsqueciSenhaForm");

describe("EsqueciSenhaForm (EPIC-24)", () => {
  beforeEach(() => requestPasswordReset.mockReset());

  it("valida o e-mail antes de enviar", async () => {
    render(<EsqueciSenhaForm />);
    await userEvent.type(screen.getByLabelText("E-mail"), "ana");
    await userEvent.click(screen.getByRole("button", { name: "Enviar link" }));
    expect(screen.getByText("Informe um e-mail válido.")).toBeTruthy();
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });

  it("pede o link e mostra a mesma resposta, exista ou não a conta", async () => {
    requestPasswordReset.mockResolvedValue({ data: { status: true }, error: null });
    render(<EsqueciSenhaForm />);
    await userEvent.type(screen.getByLabelText("E-mail"), " Ana@Example.test ");
    await userEvent.click(screen.getByRole("button", { name: "Enviar link" }));
    expect(requestPasswordReset).toHaveBeenCalledWith({ email: "ana@example.test" });
    expect(screen.getByRole("status").textContent).toContain("Se existir uma conta com ana@example.test");
  });

  it("muitos pedidos seguidos", async () => {
    requestPasswordReset.mockResolvedValue({ data: null, error: { status: 429 } });
    render(<EsqueciSenhaForm />);
    await userEvent.type(screen.getByLabelText("E-mail"), "ana@example.test");
    await userEvent.click(screen.getByRole("button", { name: "Enviar link" }));
    expect(screen.getByText(/Muitos pedidos seguidos/)).toBeTruthy();
  });
});
