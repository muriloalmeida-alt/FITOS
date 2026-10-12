import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "@/shared/ui";
import { LivreComecar } from "./LivreComecar";

const push = vi.fn();
const signUpEmail = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
vi.mock("@/modules/identity/auth-client", () => ({ signUp: { email: (...args: unknown[]) => signUpEmail(...args) } }));
beforeEach(() => window.sessionStorage.clear());
afterEach(() => {
  vi.restoreAllMocks();
  push.mockReset();
  signUpEmail.mockReset();
});

const RECOMMENDATIONS = {
  missing: ["crossfit"],
  groups: [
    { modalities: ["musculacao"], label: "Musculação", options: [{ choice: { kind: "inicial" }, name: "Plano de musculação pelas suas respostas", modalityLabel: "Musculação", facts: ["4 dias por semana"], notes: [], workouts: [{ name: "Corpo todo A", days: "seg", format: null, exercises: [] }] }] },
    { modalities: ["funcional"], label: "Funcional", options: [{ choice: { kind: "programa", key: "funcional-primeiros-passos" }, name: "Funcional — Primeiros Passos", modalityLabel: "Funcional", facts: ["3 dias por semana", "4 semanas", "25–35 min por sessão", "Iniciante"], notes: ["Carga individualizada pelo personal."], workouts: [{ name: "Base e estabilidade", days: "seg", format: "Circuito de 2 voltas", exercises: [{ name: "Bird dog", dose: "6 repetições por lado" }] }] }] },
  ],
};

function mockApi(onboarding: () => Response = () => new Response(JSON.stringify({}), { status: 201 })) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => (String(url).startsWith("/api/livre/recomendacoes") ? new Response(JSON.stringify(RECOMMENDATIONS)) : onboarding()));
}

async function answerThree(objective = /Emagrecer/, days = /3 a 4 dias/, experience = /Estou começando/) {
  await userEvent.click(screen.getByRole("radio", { name: objective }));
  await userEvent.click(screen.getByRole("radio", { name: days }));
  await userEvent.click(screen.getByRole("radio", { name: experience }));
}

function renderFlow(props: Parameters<typeof LivreComecar>[0] = {}) {
  render(
    <ToastProvider>
      <LivreComecar priceCents={1990} trialDays={30} {...props} />
    </ToastProvider>
  );
}

describe("FitOS Livre: seu jeito de treinar (proposta 11) e conta depois (EPIC-33)", () => {
  it("modalidades em seleção múltipla; Continuar só com uma ou mais; recomendações por modalidade e o aviso da que falta", async () => {
    const fetchMock = mockApi();
    renderFlow();
    await answerThree();
    expect(screen.getByRole("heading", { name: "Quais modalidades você quer praticar?" })).toBeInTheDocument();
    const next = screen.getByRole("button", { name: "Continuar" });
    expect(next).toBeDisabled();
    await userEvent.click(screen.getByRole("checkbox", { name: /Musculação/ }));
    await userEvent.click(screen.getByRole("checkbox", { name: /Funcional/ }));
    await userEvent.click(screen.getByRole("checkbox", { name: /CrossFit/ }));
    expect(screen.getByRole("checkbox", { name: /CrossFit/ })).toHaveAttribute("aria-checked", "true");
    expect(next).toBeEnabled();
    await userEvent.click(next);

    expect(await screen.findByRole("heading", { name: "Programas para você" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/livre/recomendacoes?objetivo=PERDER_PESO&dias=TRES_A_QUATRO_DIAS&experiencia=INICIANTE&modalidade=musculacao&modalidade=funcional&modalidade=crossfit");
    expect(screen.getByRole("region", { name: "Funcional" })).toBeInTheDocument();
    expect(screen.getByText("Ainda não temos programas disponíveis para esta modalidade.")).toBeInTheDocument();
    expect(screen.getByText("Você pode decidir depois.")).toBeInTheDocument();
  });

  it("detalhes antes de escolher; a conta vem depois e leva modalidades e programa", async () => {
    const fetchMock = mockApi();
    signUpEmail.mockResolvedValue({ error: null });
    renderFlow();
    await answerThree();
    await userEvent.click(screen.getByRole("checkbox", { name: /Funcional/ }));
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
    await userEvent.click(await screen.findByRole("button", { name: /Funcional — Primeiros Passos/ }));
    const detail = screen.getByRole("dialog", { name: "Funcional — Primeiros Passos" });
    expect(within(detail).getByText(/Bird dog/)).toBeInTheDocument();
    await userEvent.click(within(detail).getByRole("button", { name: "Escolher este programa" }));
    expect(screen.getByText("Escolhido: Funcional — Primeiros Passos.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Salvar e começar" }));
    await userEvent.type(screen.getByLabelText("Seu nome"), "Rafa Costa");
    await userEvent.type(screen.getByLabelText("E-mail"), "rafa@ex.test");
    await userEvent.type(screen.getByLabelText("Crie uma senha"), "senha-forte-123");
    await userEvent.click(screen.getByRole("button", { name: "Salvar e começar hoje" }));
    expect(signUpEmail).toHaveBeenCalledWith({ name: "Rafa Costa", email: "rafa@ex.test", password: "senha-forte-123", role: "INDIVIDUAL" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/onboarding",
      expect.objectContaining({ body: JSON.stringify({ objective: "PERDER_PESO", experienceLevel: "INICIANTE", weeklyAvailability: "TRES_A_QUATRO_DIAS", modalities: ["funcional"], program: { kind: "programa", key: "funcional-primeiros-passos" } }) })
    );
    expect(push).toHaveBeenCalledWith("/painel");
  });

  it("já logado: seguir ao painel sem programa; erro mantém as escolhas e permite tentar de novo", async () => {
    let fail = true;
    const fetchMock = mockApi(() => (fail ? new Response(JSON.stringify({ message: "Falhou." }), { status: 500 }) : new Response("{}", { status: 201 })));
    renderFlow({ signedIn: true });
    await answerThree(/Ganhar massa/, /1 a 2 dias/, /Treino há meses/);
    await userEvent.click(screen.getByRole("checkbox", { name: /Musculação/ }));
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
    await screen.findByRole("heading", { name: "Programas para você" });
    await userEvent.click(screen.getByRole("button", { name: "Ir para o painel" }));
    expect(await screen.findByText(/Falhou\./)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    fail = false;
    await userEvent.click(screen.getByRole("button", { name: "Ir para o painel" }));
    const bodies = fetchMock.mock.calls.filter(([url]) => url === "/api/onboarding").map(([, init]) => JSON.parse(String((init as RequestInit).body)));
    expect(bodies).toHaveLength(2);
    expect(bodies[1]).toMatchObject({ modalities: ["musculacao"], program: null });
    expect(push).toHaveBeenCalledWith("/painel");
  });

  it("voltar das recomendações mantém a seleção; recarregar retoma as respostas", async () => {
    mockApi();
    renderFlow();
    await answerThree();
    await userEvent.click(screen.getByRole("checkbox", { name: /CrossFit/ }));
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
    await userEvent.click(await screen.findByRole("button", { name: "Mudar respostas" }));
    expect(screen.getByRole("checkbox", { name: /CrossFit/ })).toHaveAttribute("aria-checked", "true");
    expect(JSON.parse(window.sessionStorage.getItem("fitos:livre-respostas")!)).toMatchObject({ modalities: ["crossfit"], answers: { objective: "PERDER_PESO" } });
  });
});
