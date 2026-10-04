import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "@/shared/ui";
import { ProgramEditor } from "./ProgramEditor";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

const fetchMock = vi.fn();
function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

beforeEach(() => vi.stubGlobal("fetch", fetchMock));
afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  push.mockReset();
});

const props = {
  workouts: [
    { id: "wa", name: "Treino A", suggestedDays: ["SEGUNDA", "QUINTA"], exerciseCount: 5, thumbnail: null },
    { id: "wb", name: "Treino B", suggestedDays: ["TERCA"], exerciseCount: 4, thumbnail: null },
  ],
  available: [{ id: "wc", name: "Core", exerciseCount: 2, inProgramName: "Outro programa" }],
  students: [
    { id: "s1", displayName: "Pedro Lima", activePlanName: null },
    { id: "s2", displayName: "Ana Costa", activePlanName: "Hipertrofia" },
  ],
};

function renderEditor(initial = { id: "p1", name: "Hipertrofia 8 semanas", durationWeeks: 8, status: "ATIVO" as const }) {
  return render(
    <ToastProvider>
      <ProgramEditor initial={initial} {...props} />
    </ToastProvider>
  );
}

describe("ProgramEditor (FIT-146)", () => {
  it("mostra a semana montada pelos dias dos treinos", () => {
    renderEditor();
    expect(screen.getByText("3 dias de treino")).toBeInTheDocument();
    expect(screen.getByLabelText("Segunda: treino previsto")).toBeInTheDocument();
    expect(screen.getByLabelText("Quarta: descanso")).toBeInTheDocument();
  });

  it("vigência com +/− salva sozinha", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(jsonResponse({}));
    renderEditor();
    await user.click(screen.getByRole("button", { name: "Aumentar semanas" }));
    expect(screen.getByText("9 semanas")).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/training-plans/p1", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ durationWeeks: 9 }) })));
  });

  it("adiciona treino avisando que vem como cópia", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(jsonResponse({ copied: true }, 201));
    renderEditor();
    await user.click(screen.getByRole("button", { name: "+ Adicionar treino" }));
    const sheet = screen.getByRole("dialog", { name: "Adicionar treino" });
    expect(within(sheet).getByText(/cópia de Outro programa/)).toBeInTheDocument();
    await user.click(within(sheet).getByRole("button", { name: /Core/ }));
    expect(fetchMock).toHaveBeenCalledWith("/api/training-plans/p1/modelos", expect.objectContaining({ body: JSON.stringify({ workoutId: "wc" }) }));
    expect(await screen.findByText("Uma cópia do treino entrou no programa")).toBeInTheDocument();
  });

  it("atribui a vários alunos de uma vez e avisa quem terá o programa substituído", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(jsonResponse({ count: 2 }, 201));
    renderEditor();
    await user.click(screen.getByRole("button", { name: "Atribuir a alunos" }));
    const sheet = screen.getByRole("dialog", { name: "Para quem?" });
    expect(within(sheet).getByRole("button", { name: "Escolha ao menos um aluno" })).toBeDisabled();
    await user.click(within(sheet).getByRole("button", { name: /Pedro Lima/ }));
    await user.click(within(sheet).getByRole("button", { name: /Ana Costa/ }));
    expect(within(sheet).getByText(/1 aluno terá o programa atual substituído/)).toBeInTheDocument();
    await user.click(within(sheet).getByRole("button", { name: "Atribuir a 2 alunos" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/training-plans/p1/atribuir", expect.objectContaining({ body: JSON.stringify({ studentIds: ["s1", "s2"] }) }));
    expect(await screen.findByText("Hipertrofia 8 semanas atribuído a 2 alunos")).toBeInTheDocument();
  });

  it("reordena e tira treino do programa", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    renderEditor();
    await user.click(screen.getByRole("button", { name: "Mover Treino B para cima" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/training-plans/p1/modelos/reordenar", expect.objectContaining({ body: JSON.stringify({ orderedWorkoutIds: ["wb", "wa"] }) }));
    await user.click(screen.getByRole("button", { name: "Tirar Treino A do programa" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/training-plans/p1/modelos/wa", expect.objectContaining({ method: "DELETE" }));
  });

  it("programa novo só é criado no primeiro gesto e vai para a URL dele", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/painel/treinos/planos/novo");
    fetchMock.mockImplementation(async (url: string) => (url === "/api/training-plans" ? jsonResponse({ id: "p-novo" }, 201) : jsonResponse({})));
    render(
      <ToastProvider>
        <ProgramEditor initial={null} workouts={[]} available={[]} students={[]} />
      </ToastProvider>
    );
    expect(fetchMock).not.toHaveBeenCalled();
    await user.type(screen.getByRole("textbox", { name: "Nome do programa" }), "Força");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/training-plans", expect.objectContaining({ method: "POST" })));
    await waitFor(() => expect(window.location.pathname).toBe("/painel/treinos/planos/p-novo"));
  });
});
