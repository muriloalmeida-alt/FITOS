import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PersonalComecar } from "./PersonalComecar";

const push = vi.fn();
const signUpEmail = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
vi.mock("@/modules/identity/auth-client", () => ({ signUp: { email: (...args: unknown[]) => signUpEmail(...args) } }));
afterEach(() => {
  vi.restoreAllMocks();
  push.mockReset();
  signUpEmail.mockReset();
  window.localStorage.clear();
});

const plans = [
  { id: "p20", name: "Personal 20", priceCents: 4990, studentLimit: 20 },
  { id: "p50", name: "Personal 50", priceCents: 6990, studentLimit: 50 },
];

describe("Começar como personal (EPIC-33, E3)", () => {
  it("um toque na faixa, conta com três campos e o nome do espaço sugerido; sem cartão", async () => {
    signUpEmail.mockResolvedValue({ error: null });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify({ redirectTo: "/painel/primeiros-passos" }), { status: 201 }));
    render(<PersonalComecar plans={plans} />);
    await userEvent.click(screen.getByRole("radio", { name: /21 a 50 alunos/ }));
    expect(screen.getByRole("heading", { name: "Crie seu espaço" })).toBeInTheDocument();
    expect(screen.getByText(/30 dias grátis, sem cartão. Perto do fim do teste, sugerimos o Personal 50 para 21 a 50 alunos/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Seu nome"), "Murilo Almeida");
    expect(screen.getByRole("button", { name: /Nome do espaço: Studio Murilo/ })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("E-mail"), "Murilo@Studio.com");
    await userEvent.type(screen.getByLabelText("Senha"), "senha-forte-123");
    await userEvent.click(screen.getByRole("button", { name: "Criar meu espaço" }));
    expect(signUpEmail).toHaveBeenCalledWith({ name: "Murilo Almeida", email: "murilo@studio.com", password: "senha-forte-123", role: "PERSONAL" });
    expect(fetchMock).toHaveBeenCalledWith("/api/onboarding-personal", expect.objectContaining({ body: JSON.stringify({ studentRangeEstimate: "DE_21_A_50", businessName: "Studio Murilo" }) }));
    expect(push).toHaveBeenCalledWith("/painel/primeiros-passos");
    expect(JSON.parse(window.localStorage.getItem("fitos:conta")!)).toMatchObject({ name: "Murilo Almeida", email: "murilo@studio.com", role: "PERSONAL" });
  });

  it("já logado (cadastro incompleto): só a pergunta, e segue", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify({ redirectTo: "/painel/primeiros-passos" }), { status: 201 }));
    render(<PersonalComecar plans={plans} signedIn />);
    await userEvent.click(screen.getByRole("radio", { name: /Estou começando/ }));
    expect(push).toHaveBeenCalledWith("/painel/primeiros-passos");
    expect(signUpEmail).not.toHaveBeenCalled();
  });
});
