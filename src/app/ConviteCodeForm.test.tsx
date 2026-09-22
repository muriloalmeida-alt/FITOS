import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConviteCodeForm } from "./ConviteCodeForm";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: (...args: unknown[]) => push(...args) }),
}));

describe("ConviteCodeForm (FIT-110)", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("rejeita envio vazio, sem navegar", async () => {
    const user = userEvent.setup();
    render(<ConviteCodeForm />);

    await user.click(screen.getByRole("button", { name: "Acessar com o código" }));

    expect(await screen.findByText("Cole o código recebido do seu personal.")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("navega para /ativar-conta com o token informado, codificado na URL", async () => {
    const user = userEvent.setup();
    render(<ConviteCodeForm />);

    await user.type(screen.getByLabelText("Já tem um código de convite?"), "abc/123+xyz");
    await user.click(screen.getByRole("button", { name: "Acessar com o código" }));

    expect(push).toHaveBeenCalledWith(`/ativar-conta?token=${encodeURIComponent("abc/123+xyz")}`);
  });

  it("remove espaços nas pontas antes de validar/navegar", async () => {
    const user = userEvent.setup();
    render(<ConviteCodeForm />);

    await user.type(screen.getByLabelText("Já tem um código de convite?"), "   ");
    await user.click(screen.getByRole("button", { name: "Acessar com o código" }));

    expect(await screen.findByText("Cole o código recebido do seu personal.")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
