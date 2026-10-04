import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { tokenFromInvite } from "./ConviteEntrada";

const signUpEmail = vi.fn();
const push = vi.fn();
vi.mock("@/modules/identity/auth-client", () => ({ signUp: { email: (...args: unknown[]) => signUpEmail(...args) } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

describe("CriarContaForm (FIT-164)", () => {
  afterEach(() => vi.resetAllMocks());

  async function fill(mode: "personal" | "individual", accept = true) {
    const { CriarContaForm } = await import("./CriarContaForm");
    const user = userEvent.setup();
    render(<CriarContaForm mode={mode} />);
    await user.type(screen.getByLabelText("Seu nome"), "Joana Lima");
    await user.type(screen.getByLabelText("E-mail"), "Joana@Example.com");
    await user.type(screen.getByLabelText("Senha"), "senha-forte-123");
    if (accept) await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Criar conta" }));
  }

  it("cria a conta do personal e segue para o onboarding do personal", async () => {
    signUpEmail.mockResolvedValue({ error: null });
    await fill("personal");
    await waitFor(() => expect(push).toHaveBeenCalledWith("/onboarding-personal"));
    expect(signUpEmail).toHaveBeenCalledWith({ name: "Joana Lima", email: "joana@example.com", password: "senha-forte-123", role: "PERSONAL" });
  });

  it("Livre segue para o onboarding do Livre", async () => {
    signUpEmail.mockResolvedValue({ error: null });
    await fill("individual");
    await waitFor(() => expect(push).toHaveBeenCalledWith("/onboarding"));
  });

  it("sem aceitar os termos não cria a conta", async () => {
    await fill("personal", false);
    expect(await screen.findByText("Aceite os termos para continuar.")).toBeInTheDocument();
    expect(signUpEmail).not.toHaveBeenCalled();
  });

  it("Mostrar revela a senha", async () => {
    const { CriarContaForm } = await import("./CriarContaForm");
    const user = userEvent.setup();
    render(<CriarContaForm />);
    await user.click(screen.getByRole("button", { name: "Mostrar" }));
    expect(screen.getByLabelText("Senha")).toHaveAttribute("type", "text");
  });
});

describe("tokenFromInvite", () => {
  it("lê o código ou o link", () => {
    expect(tokenFromInvite(" abc ")).toBe("abc");
    expect(tokenFromInvite("https://fitos.app/ativar-conta?token=x%2By")).toBe("x+y");
  });
});
