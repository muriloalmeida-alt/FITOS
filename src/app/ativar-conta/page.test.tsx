import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const checkActivationToken = vi.fn();

vi.mock("@/modules/identity/activation", async () => {
  const actual = await vi.importActual<typeof import("@/modules/identity/activation")>(
    "@/modules/identity/activation"
  );
  return { ...actual, checkActivationToken: (...args: unknown[]) => checkActivationToken(...args) };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("AtivarContaPage (FIT-015)", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("sem token na URL: mostra a mensagem genérica, sem consultar o domínio", async () => {
    const { default: AtivarContaPage } = await import("./page");

    render(await AtivarContaPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText(/Este link não é válido ou já expirou/)).toBeInTheDocument();
    expect(checkActivationToken).not.toHaveBeenCalled();
  });

  it("token inválido: mostra a mensagem genérica, sem nenhum dado do aluno", async () => {
    checkActivationToken.mockResolvedValue({ valid: false });
    const { default: AtivarContaPage } = await import("./page");

    render(await AtivarContaPage({ searchParams: Promise.resolve({ token: "invalido" }) }));

    expect(screen.getByText(/Este link não é válido ou já expirou/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ativar conta" })).not.toBeInTheDocument();
  });

  it("token válido: mostra o nome do aluno e o formulário de senha", async () => {
    checkActivationToken.mockResolvedValue({ valid: true, studentName: "Fulano de Tal" });
    const { default: AtivarContaPage } = await import("./page");

    render(await AtivarContaPage({ searchParams: Promise.resolve({ token: "valido" }) }));

    expect(screen.getByText(/Fulano de Tal/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ativar conta" })).toBeInTheDocument();
  });
});
