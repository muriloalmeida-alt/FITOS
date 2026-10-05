import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "@/shared/ui";
import { WorkoutEditor } from "./WorkoutEditor";
import { PERSONAL_WORKOUT_API, type EditorWorkout, type LibraryExercise } from "./types";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

const library: LibraryExercise[] = [
  { id: "ex-agach", name: "Agachamento livre", muscle: "Quadríceps", imageUrl: null, imageAlt: null },
  { id: "ex-remada", name: "Remada baixa", muscle: "Costas", imageUrl: null, imageAlt: null },
  { id: "ex-prancha", name: "Prancha frontal", muscle: "Core", imageUrl: null, imageAlt: null },
];

function jsonResponse(body: unknown, status = 200) {
  return new Response(body === null ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  window.history.replaceState(null, "", "/painel/treinos/novo");
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  push.mockReset();
});

function renderEditor(initial: EditorWorkout | null) {
  return render(
    <ToastProvider>
      <WorkoutEditor api={PERSONAL_WORKOUT_API} initial={initial} library={library} renderDone={() => <p>Próximo passo do treino</p>} />
    </ToastProvider>
  );
}

describe("WorkoutEditor (FIT-146)", () => {
  it("treino novo não cria nada ao abrir; escolher vários na biblioteca cria o treino e adiciona com 3 × 12", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(async (url: string) => {
      if (url === "/api/workouts") return jsonResponse({ id: "w-novo" }, 201);
      if (url === "/api/workouts/w-novo/itens/lote")
        return jsonResponse(
          [
            { id: "i1", exerciseId: "ex-agach", sets: 3, reps: 12, durationSeconds: null, load: null, restSeconds: 60, notes: null },
            { id: "i2", exerciseId: "ex-prancha", sets: 3, reps: 12, durationSeconds: null, load: null, restSeconds: 60, notes: null },
          ],
          201
        );
      return jsonResponse({});
    });
    renderEditor(null);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "Nome do treino" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Escolher na biblioteca" }));
    const dialog = screen.getByRole("dialog", { name: "Toque para escolher" });
    await user.click(within(dialog).getByRole("button", { name: /Agachamento livre/ }));
    await user.click(within(dialog).getByRole("button", { name: /Prancha frontal/ }));
    await user.click(within(dialog).getByRole("button", { name: "Adicionar 2 exercícios" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith("/api/workouts", expect.objectContaining({ method: "POST", body: JSON.stringify({ name: "Novo treino" }) }));
    expect(fetchMock).toHaveBeenCalledWith("/api/workouts/w-novo/itens/lote", expect.objectContaining({ body: JSON.stringify({ exerciseIds: ["ex-agach", "ex-prancha"] }) }));
    expect(screen.getByRole("heading", { name: "2 exercícios" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/painel/treinos/w-novo");
  });

  it("a biblioteca filtra por busca e por músculo", async () => {
    const user = userEvent.setup();
    renderEditor(null);
    await user.click(screen.getByRole("button", { name: "Escolher na biblioteca" }));
    const dialog = screen.getByRole("dialog", { name: "Toque para escolher" });
    await user.type(within(dialog).getByRole("textbox", { name: "Buscar exercício" }), "remada");
    expect(within(dialog).queryByRole("button", { name: /Agachamento/ })).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /Remada baixa/ })).toBeInTheDocument();
    await user.clear(within(dialog).getByRole("textbox", { name: "Buscar exercício" }));
    await user.click(within(dialog).getByRole("radio", { name: "Core" }));
    expect(within(dialog).getByRole("button", { name: /Prancha frontal/ })).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: /Remada/ })).not.toBeInTheDocument();
  });

  const existing: EditorWorkout = {
    id: "w1",
    name: "Treino A",
    suggestedDays: ["SEGUNDA"],
    status: "ATIVO",
    items: [
      { id: "i1", exerciseId: "ex-agach", name: "Agachamento livre", muscle: "Quadríceps", imageUrl: null, imageAlt: null, sets: 4, reps: 10, durationSeconds: null, load: "40 kg", restSeconds: 90, notes: null, intensity: null },
      { id: "i2", exerciseId: "ex-remada", name: "Remada baixa", muscle: "Costas", imageUrl: null, imageAlt: null, sets: 3, reps: 12, durationSeconds: null, load: null, restSeconds: 60, notes: null, intensity: null },
    ],
  };

  it("+ e − agrupam toques e salvam o item sozinho, com carga em kg", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(jsonResponse({}));
    renderEditor(existing);
    const first = screen.getAllByRole("listitem")[0]!;
    await user.click(within(first).getByRole("button", { name: "Aumentar carga" }));
    await user.click(within(first).getByRole("button", { name: "Aumentar carga" }));
    await user.click(within(first).getByRole("button", { name: "Aumentar séries" }));
    expect(within(first).getByText("45 kg")).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith("/api/workouts/w1/itens/i1", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ load: "45 kg", sets: 5 }) }));
    await waitFor(() => expect(screen.getByText("Salvo automaticamente")).toBeInTheDocument());
  });

  it("dias sugeridos salvam no treino; medir por tempo troca repetições por segundos", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(jsonResponse({}));
    renderEditor(existing);
    await user.click(screen.getByRole("button", { name: "Qui" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/workouts/w1", expect.objectContaining({ body: JSON.stringify({ suggestedDays: ["SEGUNDA", "QUINTA"] }) })));
    const second = screen.getAllByRole("listitem")[1]!;
    await user.click(within(second).getByRole("button", { name: "Tempo, descanso e observação" }));
    await user.click(within(second).getByRole("radio", { name: "Tempo" }));
    expect(within(second).getByText("30 s")).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/workouts/w1/itens/i2", expect.objectContaining({ body: JSON.stringify({ reps: null, durationSeconds: 30 }) })));
  });

  it("reordena, remove e abre o próximo passo em Pronto", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(jsonResponse(null, 204));
    renderEditor(existing);
    await user.click(screen.getByRole("button", { name: "Mover Remada baixa para cima" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/workouts/w1/itens/reordenar", expect.objectContaining({ body: JSON.stringify({ orderedIds: ["i2", "i1"] }) }));
    await user.click(screen.getByRole("button", { name: "Remover Agachamento livre" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/workouts/w1/itens/i1", expect.objectContaining({ method: "DELETE" }));
    await user.click(screen.getByRole("button", { name: "Pronto" }));
    expect(await screen.findByRole("dialog", { name: "Treino pronto" })).toBeInTheDocument();
    expect(screen.getByText("Próximo passo do treino")).toBeInTheDocument();
  });

  it("mostra o erro do servidor sem perder o que foi feito", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(jsonResponse({ message: "Séries deve ser um número inteiro maior que zero." }, 400));
    renderEditor(existing);
    const first = screen.getAllByRole("listitem")[0]!;
    await user.click(within(first).getByRole("button", { name: "Aumentar séries" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Séries deve ser um número inteiro maior que zero.");
    expect(screen.getByText("Não salvo")).toBeInTheDocument();
    expect(within(first).getByText("5")).toBeInTheDocument();
  });
});
