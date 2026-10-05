import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { ToastProvider } from "@/shared/ui";
import { LiveWorkout, type LiveItem } from "./LiveWorkout";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

const squat: LiveItem = { id: "we1", name: "Agachamento", imageUrl: null, imageAlt: null, instructions: null, sets: 2, reps: 10, durationSeconds: null, loadKg: 40, load: "40 kg", restSeconds: 60, notes: null, intensity: null, doneSets: [], last: null };
const plank: LiveItem = { id: "we2", name: "Prancha", imageUrl: null, imageAlt: null, instructions: null, sets: 1, reps: null, durationSeconds: 30, loadKg: null, load: null, restSeconds: 30, notes: null, intensity: null, doneSets: [], last: null };

function json(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }));
}

function renderLive(items: LiveItem[] = [squat, plank], sessionId: string | null = "sess1") {
  render(
    <ToastProvider>
      <LiveWorkout sessionId={sessionId} workoutId="w1" workoutName="Treino A" startedAt={new Date().toISOString()} items={items} coachName="Joana Lima" apiBase="/api/workout-sessions" exitHref="/painel" progressHref="/painel/progresso" />
    </ToastProvider>
  );
}

describe("LiveWorkout (FIT-153)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    push.mockReset();
    window.localStorage.clear();
  });

  it("série feita grava a série com a carga e as repetições ajustadas e abre o descanso", async () => {
    fetchMock.mockReturnValue(json({ setNumber: 1, personalRecord: false }, 201));
    renderLive();
    fireEvent.click(screen.getByRole("button", { name: "Aumentar carga" }));
    fireEvent.click(screen.getByRole("button", { name: "Menos repetições" }));
    expect(screen.getByText("42,5")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Série feita/ }));
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/workout-sessions/sess1/series", expect.objectContaining({ method: "POST", body: JSON.stringify({ workoutExerciseId: "we1", setNumber: 1, reps: 9, durationSeconds: null, loadKg: 42.5 }) }));
    const rest = screen.getByRole("dialog", { name: "Descanso" });
    expect(within(rest).getByText("Agachamento · série 2 de 2")).toBeInTheDocument();
    fireEvent.click(within(rest).getByRole("button", { name: "Pular descanso" }));
    expect(screen.queryByRole("dialog", { name: "Descanso" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("1 de 2 séries feitas")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Última série feita/ })).toBeInTheDocument();
  });

  it("falha ao salvar desfaz a série na tela", async () => {
    fetchMock.mockReturnValue(json({ message: "Sem conexão" }, 500));
    renderLive();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Série feita/ }));
    });
    expect(screen.getByLabelText("0 de 2 séries feitas")).toBeInTheDocument();
    expect(await screen.findByText("Sem conexão")).toBeInTheDocument();
  });

  it("lista do treino troca a ordem e o exercício por tempo tem cronômetro", () => {
    renderLive();
    fireEvent.click(screen.getByRole("button", { name: "Ver treino completo" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Treino completo" })).getByRole("button", { name: /Prancha/ }));
    expect(screen.getByRole("heading", { level: 1, name: "Prancha" })).toBeInTheDocument();
    expect(screen.getByRole("timer")).toHaveTextContent("00:30");
    expect(screen.getByRole("button", { name: "Iniciar cronômetro do exercício" })).toBeInTheDocument();
  });

  it("concluir mostra o resumo e envia como foi o treino", async () => {
    fetchMock.mockImplementation((url: string) =>
      url.endsWith("/concluir") ? json({ id: "sess1", status: "CONCLUIDA", summary: { activeSeconds: 2520, sets: 12, volumeKg: 3480, records: [{ exerciseName: "Agachamento", loadKg: 45 }], perceivedEffort: null } }) : Promise.resolve(new Response(null, { status: 204 }))
    );
    renderLive();
    fireEvent.click(screen.getByRole("button", { name: "Encerrar treino" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Concluir com o que fiz" }));
    });
    expect(screen.getByRole("heading", { level: 1, name: "Mandou bem!" })).toBeInTheDocument();
    expect(screen.getByText("42 min")).toBeInTheDocument();
    expect(screen.getByText("3480")).toBeInTheDocument();
    expect(screen.getByText(/Novo recorde · Agachamento: 45 kg/)).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole("radio", { name: /Puxado/ }));
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/workout-sessions/sess1/esforco", expect.objectContaining({ body: JSON.stringify({ perceivedEffort: 4 }) }));
    expect(screen.getByRole("link", { name: "Concluir" })).toHaveAttribute("href", "/painel");
  });

  it("preparação começa a sessão e música abre os atalhos dos apps", async () => {
    fetchMock.mockReturnValue(json({ id: "sess9", startedAt: new Date().toISOString() }, 201));
    renderLive([squat], null);
    fireEvent.click(screen.getByRole("button", { name: /Música/ }));
    expect(screen.getByRole("link", { name: "Spotify" })).toHaveAttribute("href", "https://open.spotify.com");
    expect(screen.getByRole("link", { name: "YouTube Music" })).toHaveAttribute("target", "_blank");
    fireEvent.click(screen.getByRole("button", { name: "Voltar ao treino" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Começar treino" }));
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/workout-sessions", expect.objectContaining({ body: JSON.stringify({ workoutId: "w1" }) }));
    expect(screen.getByRole("button", { name: /Série feita|Última série feita/ })).toBeInTheDocument();
  });
});
