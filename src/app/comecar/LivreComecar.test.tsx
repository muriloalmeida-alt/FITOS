import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "@/shared/ui";
import { LivreComecar } from "./LivreComecar";

const push = vi.fn();
const signUpEmail = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
vi.mock("@/modules/identity/auth-client", () => ({ signUp: { email: (...args: unknown[]) => signUpEmail(...args) } }));
afterEach(() => {
  vi.restoreAllMocks();
  push.mockReset();
  signUpEmail.mockReset();
});

function mockApi() {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (url) =>
    String(url).startsWith("/api/livre/previa")
      ? new Response(JSON.stringify({ workouts: [{ name: "Corpo todo A", days: ["SEGUNDA"], exercises: 6, minutes: 35 }, { name: "Caminhada inclinada", days: ["TERCA"], exercises: 1, minutes: 30 }] }))
      : new Response(JSON.stringify({}), { status: 201 })
  );
}

describe("FitOS Livre: plano antes da conta (EPIC-33, L1 + E6)", () => {
  it("três toques mostram o plano; a conta vem depois, sem cartão", async () => {
    const fetchMock = mockApi();
    signUpEmail.mockResolvedValue({ error: null });
    render(
      <ToastProvider>
        <LivreComecar priceCents={1990} trialDays={30} />
      </ToastProvider>
    );
    await userEvent.click(screen.getByRole("radio", { name: /Emagrecer/ }));
    await userEvent.click(screen.getByRole("radio", { name: /3 a 4 dias/ }));
    await userEvent.click(screen.getByRole("radio", { name: /Estou começando/ }));
    expect(await screen.findByText("Corpo todo A")).toBeInTheDocument();
    expect(screen.getByText("seg · cerca de 35 min")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/livre/previa?objetivo=PERDER_PESO&dias=TRES_A_QUATRO_DIAS&experiencia=INICIANTE");
    expect(screen.getByText(/30 dias grátis, sem cartão. Perto do fim, você escolhe continuar por R\$\s19,90 por mês./)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Salvar e começar" }));
    await userEvent.type(screen.getByLabelText("Seu nome"), "Rafa Costa");
    await userEvent.type(screen.getByLabelText("E-mail"), "rafa@ex.test");
    await userEvent.type(screen.getByLabelText("Crie uma senha"), "senha-forte-123");
    await userEvent.click(screen.getByRole("button", { name: "Salvar e começar hoje" }));
    expect(signUpEmail).toHaveBeenCalledWith({ name: "Rafa Costa", email: "rafa@ex.test", password: "senha-forte-123", role: "INDIVIDUAL" });
    expect(fetchMock).toHaveBeenCalledWith("/api/onboarding", expect.objectContaining({ body: JSON.stringify({ objective: "PERDER_PESO", experienceLevel: "INICIANTE", weeklyAvailability: "TRES_A_QUATRO_DIAS" }) }));
    expect(push).toHaveBeenCalledWith("/painel");
  });

  it("já logado: Começar hoje conclui direto", async () => {
    const fetchMock = mockApi();
    render(
      <ToastProvider>
        <LivreComecar signedIn />
      </ToastProvider>
    );
    await userEvent.click(screen.getByRole("radio", { name: /Ganhar massa/ }));
    await userEvent.click(screen.getByRole("radio", { name: /1 a 2 dias/ }));
    await userEvent.click(screen.getByRole("radio", { name: /Treino há meses/ }));
    await screen.findByText("Corpo todo A");
    await userEvent.click(screen.getByRole("button", { name: "Começar hoje" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/onboarding", expect.anything());
    expect(signUpEmail).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/painel");
  });
});
