import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CadastrarExercicioForm } from "./CadastrarExercicioForm";

const push = vi.fn();
const refresh = vi.fn();
const searchParamsGet = vi.fn().mockReturnValue(null);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
  useSearchParams: () => ({ get: searchParamsGet }),
}));

describe("CadastrarExercicioForm (FIT-142: returnTo pós-cadastro)", () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllGlobals();
    searchParamsGet.mockReturnValue(null);
  });

  it("sem ?returnTo: volta para /painel/exercicios (fluxo original do personal)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "e1" }) }));
    const user = userEvent.setup();
    render(<CadastrarExercicioForm />);

    await user.type(screen.getByLabelText("Nome"), "Rosca direta");
    await user.click(screen.getByRole("button", { name: "Cadastrar exercício" }));

    expect(await screen.findByRole("button", { name: "Cadastrar exercício" })).toBeInTheDocument();
    expect(push).toHaveBeenCalledWith("/painel/exercicios");
    expect(refresh).toHaveBeenCalled();
  });

  it("FIT-142: com ?returnTo interno (ex.: builder de treino do Livre), volta exatamente para lá", async () => {
    searchParamsGet.mockReturnValue("/painel/meus-treinos/w1");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "e1" }) }));
    const user = userEvent.setup();
    render(<CadastrarExercicioForm />);

    await user.type(screen.getByLabelText("Nome"), "Flexão diamante");
    await user.click(screen.getByRole("button", { name: "Cadastrar exercício" }));

    expect(push).toHaveBeenCalledWith("/painel/meus-treinos/w1");
  });

  it("FIT-142: nunca aceita um returnTo externo (proteção contra open redirect) — cai no padrão", async () => {
    searchParamsGet.mockReturnValue("//evil.example.com");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "e1" }) }));
    const user = userEvent.setup();
    render(<CadastrarExercicioForm />);

    await user.type(screen.getByLabelText("Nome"), "Rosca direta");
    await user.click(screen.getByRole("button", { name: "Cadastrar exercício" }));

    expect(push).toHaveBeenCalledWith("/painel/exercicios");
  });

  it("mostra erro de validação quando o nome está vazio, sem chamar fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<CadastrarExercicioForm />);

    await user.click(screen.getByRole("button", { name: "Cadastrar exercício" }));

    expect(await screen.findByText("Informe o nome do exercício.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
