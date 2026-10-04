import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "@/shared/ui";
import { StudentProfile } from "./StudentProfile";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValue(new Response(JSON.stringify({}), { status: 201 }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

const student = { id: "s1", displayName: "Pedro Lima", email: "pedro@x.com", status: "ATIVO" as "ATIVO" | "INATIVO" | "VINCULO_ENCERRADO", hasAccount: false, sinceLabel: "agosto de 2026", endedLabel: null, endReason: null };
const base = {
  student,
  access: { status: "CONVITE_PENDENTE" as const, daysLeft: 5 },
  program: null,
  programs: [{ id: "p1", name: "Hipertrofia", durationWeeks: 8, workoutCount: 2, days: ["SEGUNDA", "QUINTA"] }],
  week: { done: 0, target: null },
  sessions: [{ id: "x1", workoutName: "Treino A", dateLabel: "há 9 dias", status: "CONCLUIDA" as const, perceivedEffort: 4 }],
  assessments: [{ id: "a1", dateLabel: "3 de agosto", weightKg: 82.4, bodyFatPercent: 21.5, notes: null, measurements: [{ type: "CINTURA", valueCm: 86 }] }],
  openCharge: { id: "c1", description: "Mensalidade de outubro", amountCents: 18000, status: "ATRASADO" as const, dueLabel: "01/10", paidLabel: null },
  recurrence: { amountCents: 18000, day: 10 },
  initialSheet: null,
};

function renderProfile(over: Partial<typeof base> = {}) {
  return render(
    <ToastProvider>
      <StudentProfile {...base} {...over} />
    </ToastProvider>
  );
}

describe("StudentProfile (FIT-145)", () => {
  it("sem programa: foco com Atribuir; escolher e atribuir em dois toques", async () => {
    const user = userEvent.setup();
    renderProfile();
    expect(screen.getByText("Pedro está sem programa")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Atribuir programa" }));
    const sheet = screen.getByRole("dialog", { name: "Qual programa para Pedro?" });
    await user.click(within(sheet).getByRole("radio", { name: /Hipertrofia/ }));
    await user.click(within(sheet).getByRole("button", { name: "Atribuir a Pedro" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/students/s1/plano", expect.objectContaining({ method: "POST", body: JSON.stringify({ trainingPlanId: "p1" }) }));
  });

  it("avaliação começa com os últimos valores e envia peso, gordura e medidas preenchidas", async () => {
    const user = userEvent.setup();
    renderProfile();
    await user.click(screen.getByRole("button", { name: "Registrar" }));
    const sheet = screen.getByRole("dialog", { name: "Avaliação de hoje" });
    expect(within(sheet).getByText("82,4")).toBeInTheDocument();
    await user.click(within(sheet).getByRole("button", { name: "Diminuir peso (kg)" }));
    await user.click(within(sheet).getByRole("button", { name: "Salvar avaliação" }));
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/students/s1/avaliacoes");
    expect(body).toEqual({ weightKg: 82.3, bodyFatPercent: 21.5, notes: null, measurements: [{ type: "CINTURA", valueCm: 86 }] });
  });

  it("'Recebi' registra a mensalidade com a forma escolhida", async () => {
    const user = userEvent.setup();
    renderProfile();
    await user.click(screen.getByRole("button", { name: "Recebi" }));
    const sheet = screen.getByRole("dialog", { name: "Recebi de Pedro" });
    await user.click(within(sheet).getByRole("radio", { name: "Dinheiro" }));
    await user.click(within(sheet).getByRole("button", { name: "Confirmar pagamento" }));
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/cobrancas/c1/pagamentos");
    expect(JSON.parse(init.body)).toMatchObject({ amountReceivedReais: 180, method: "Dinheiro" });
  });

  it("mostra esforço percebido, convite pendente com novo link e cancelar", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ link: "https://fitos.app/ativar-conta?token=z" }), { status: 201 }));
    renderProfile();
    expect(screen.getByText("Esforço 4/5 · Difícil")).toBeInTheDocument();
    expect(screen.getByText("Vale por mais 5 dias.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Gerar novo link" }));
    const sheet = screen.getByRole("dialog", { name: "Convite de Pedro" });
    expect(within(sheet).getByRole("button", { name: /Cancelar convite/ })).toBeInTheDocument();
    await user.click(within(sheet).getByRole("button", { name: "Gerar novo link" }));
    expect(await within(sheet).findByRole("textbox", { name: "Link de ativação" })).toHaveValue("https://fitos.app/ativar-conta?token=z");
  });

  it("encerrar vínculo pede confirmação com motivo opcional e volta para a lista", async () => {
    const user = userEvent.setup();
    renderProfile({ initialSheet: "end" as never });
    const sheet = screen.getByRole("dialog", { name: "Encerrar vínculo com Pedro?" });
    await user.click(within(sheet).getByRole("radio", { name: "Mudança de cidade" }));
    await user.click(within(sheet).getByRole("button", { name: "Encerrar vínculo" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/students/s1/encerrar-vinculo", expect.objectContaining({ body: JSON.stringify({ reason: "Mudança de cidade" }) }));
    expect(push).toHaveBeenCalledWith("/painel/alunos");
  });

  it("inativo mostra reativar e não oferece atribuir", () => {
    renderProfile({ student: { ...student, status: "INATIVO" } });
    expect(screen.getByRole("button", { name: "Reativar Pedro" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Atribuir programa" })).not.toBeInTheDocument();
  });
});
