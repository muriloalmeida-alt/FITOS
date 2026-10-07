import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { ToastProvider } from "@/shared/ui";
import { LiveWorkout, type LiveItem } from "./LiveWorkout";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

const squat: LiveItem = { id: "we1", exerciseId: "ex1", name: "Agachamento", imageUrl: null, imageAlt: null, instructions: null, sets: 2, reps: 10, durationSeconds: null, loadKg: 40, load: "40 kg", restSeconds: 60, notes: null, intensity: null, doneSets: [], last: null };
const plank: LiveItem = { id: "we2", exerciseId: "ex2", name: "Prancha", imageUrl: null, imageAlt: null, instructions: null, sets: 1, reps: null, durationSeconds: 30, loadKg: null, load: null, restSeconds: 30, notes: null, intensity: null, doneSets: [], last: null };

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
      fireEvent.click(screen.getByRole("button", { name: "Fiz 9 × 42,5 kg" }));
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/workout-sessions/sess1/series", expect.objectContaining({ method: "POST", body: JSON.stringify({ workoutExerciseId: "we1", setNumber: 1, reps: 9, durationSeconds: null, loadKg: 42.5, performedExerciseId: null }) }));
    const rest = screen.getByRole("dialog", { name: "Descanso" });
    expect(within(rest).getByText("Agachamento · série 2 de 2")).toBeInTheDocument();
    fireEvent.click(within(rest).getByRole("button", { name: "Pular descanso" }));
    expect(screen.queryByRole("dialog", { name: "Descanso" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("1 de 2 séries feitas")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Fiz .*última série$/ })).toBeInTheDocument();
  });

  it("falha ao salvar desfaz a série na tela", async () => {
    fetchMock.mockReturnValue(json({ message: "Sem conexão" }, 500));
    renderLive();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^Fiz / }));
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
    expect(screen.getByRole("button", { name: /^Fiz / })).toBeInTheDocument();
  });

  it("aparelho ocupado: troca só hoje e a série vai com o exercício trocado (EPIC-38)", async () => {
    fetchMock.mockImplementation((url: string) =>
      url.includes("/alternativas") ? json({ options: [{ id: "ex9", name: "Agachamento no Smith", imageUrl: null, imageAlt: null }] }) : json({ setNumber: 1, personalRecord: false }, 201)
    );
    renderLive();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Aparelho ocupado?" }));
    });
    const sheet = screen.getByRole("dialog", { name: "Aparelho ocupado?" });
    expect(within(sheet).getByRole("button", { name: "Fazer depois, volto no fim" })).toBeInTheDocument();
    fireEvent.click(await within(sheet).findByRole("button", { name: /Agachamento no Smith/ }));
    expect(screen.getByRole("heading", { level: 1, name: "Agachamento no Smith" })).toBeInTheDocument();
    expect(screen.getByText("Hoje, no lugar de Agachamento")).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^Fiz / }));
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/workout-sessions/sess1/series", expect.objectContaining({ body: expect.stringContaining('"performedExerciseId":"ex9"') }));
  });

  it("aparelho ocupado: fazer depois passa para o próximo exercício", async () => {
    fetchMock.mockReturnValue(json({ options: [] }));
    renderLive();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Aparelho ocupado?" }));
    });
    fireEvent.click(screen.getByRole("button", { name: "Fazer depois, volto no fim" }));
    expect(screen.getByRole("heading", { level: 1, name: "Prancha" })).toBeInTheDocument();
  });

  it("só tenho X min: a preparação oferece uma versão menor sem mudar o programa (EPIC-38)", () => {
    const many = ["A", "B", "C", "D", "E", "F"].map((name, index) => ({ ...squat, id: `w${index}`, exerciseId: `e${index}`, name, sets: 4 }));
    renderLive(many, null);
    expect(screen.getByText(/6 exercícios · 24 séries · cerca de 40 min/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Só 20 min" }));
    expect(screen.getByText(/6 exercícios · 12 séries · cerca de 20 min/)).toBeInTheDocument();
    expect(screen.getByText("Versão de 20 min: 2 séries por exercício. Seu programa não muda.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Completo · 40 min" }));
    expect(screen.getByText(/24 séries/)).toBeInTheDocument();
  });
  it("treino avulso: começa vazio, inclui o exercício na hora e salva nos meus treinos", async () => {
    const library = [{ id: "ex9", name: "Remada curvada", muscle: "Costas", imageUrl: null, imageAlt: null }];
    const added: LiveItem = { ...squat, id: "we9", exerciseId: "ex9", name: "Remada curvada", sets: 3, reps: 12, loadKg: null, load: null };
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith("/exercicios")) return json({ items: [added] }, 201);
      if (url.endsWith("/series")) return json({ setNumber: 1, personalRecord: false }, 201);
      if (url.endsWith("/concluir")) return json({ summary: { activeSeconds: 300, sets: 1, volumeKg: 0, records: [] } });
      if (url.endsWith("/salvar")) return json({ workoutId: "w9", name: "Costas rápido" });
      if (url.endsWith("/avaliacao")) return json({ score: 2, label: "Deu para começar", worked: [{ area: "Costas", sets: 1 }], missing: [{ area: "Peitoral", reason: "Nenhuma série nos últimos 7 dias." }], reasons: [{ ok: false, text: "Só 1 série: volume baixo." }], cardioMinutes: 0 });
      return json({});
    });
    render(
      <ToastProvider>
        <LiveWorkout sessionId="sess9" workoutId="w9" workoutName="Treino avulso" startedAt={new Date().toISOString()} items={[]} coachName={null} apiBase="/api/minhas-sessoes" exitHref="/painel" progressHref="/painel/minha-evolucao" free={{ library, focus: ["Costas", "Aeróbico"] }} />
      </ToastProvider>
    );
    expect(screen.getByRole("heading", { name: "O que você vai fazer agora?" })).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Seu foco hoje" })).getAllByRole("listitem").map((item) => item.textContent)).toEqual(["Costas", "Aeróbico"]);
    fireEvent.click(screen.getByRole("button", { name: "Encerrar treino" }));
    expect(screen.getByRole("button", { name: "Sair sem salvar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Concluir/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "+ Adicionar exercício" }));
    fireEvent.click(screen.getByRole("button", { name: /Remada curvada/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Adicionar 1 exercício" }));
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/minhas-sessoes/sess9/exercicios", expect.objectContaining({ method: "POST", body: JSON.stringify({ exerciseIds: ["ex9"] }) }));
    expect(screen.getByRole("heading", { level: 1, name: "Remada curvada" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Aparelho ocupado?" })).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^Fiz 12/ }));
    });
    fireEvent.click(screen.getByRole("button", { name: "Encerrar treino" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Concluir com o que fiz" }));
    });
    expect(screen.getByText("Avaliação do treino")).toBeInTheDocument();
    expect(screen.getByLabelText("Nota 2 de 5")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Deu para começar" })).toBeInTheDocument();
    expect(screen.getByText("Nenhuma série nos últimos 7 dias.")).toBeInTheDocument();
    expect(screen.getByText("Só 1 série: volume baixo.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver resumo" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar nos meus treinos" }));
    fireEvent.change(screen.getByLabelText("Nome do treino"), { target: { value: "Costas rápido" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/minhas-sessoes/sess9/salvar", expect.objectContaining({ body: JSON.stringify({ name: "Costas rápido" }) }));
    expect(screen.getByText("Salvo em Meus treinos. Dá para repetir outro dia.")).toBeInTheDocument();
  });
  it("treino avulso: aeróbico com tempo livre, sem etapas, e registra o tempo feito", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const bike: LiveItem = { ...squat, id: "we7", exerciseId: "ex7", name: "Bike ergométrica", sets: null, reps: null, durationSeconds: 1200, loadKg: null, load: null, intensity: "MODERADO" };
    fetchMock.mockReturnValue(json({ setNumber: 1, personalRecord: false }, 201));
    render(
      <ToastProvider>
        <LiveWorkout sessionId="sess7" workoutId="w7" workoutName="Treino avulso" startedAt={new Date().toISOString()} items={[bike]} coachName={null} apiBase="/api/minhas-sessoes" exitHref="/painel" progressHref="/painel/minha-evolucao" free={{ library: [] }} />
      </ToastProvider>
    );
    expect(screen.getAllByText("Tempo livre")).toHaveLength(2);
    expect(screen.queryByText(/Aquecimento/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Inicie o tempo/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Iniciar" }));
    fireEvent.click(screen.getByRole("button", { name: "Somar 1 minuto" }));
    fireEvent.click(screen.getByRole("button", { name: "Somar 1 minuto" }));
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });
    fireEvent.click(screen.getByRole("button", { name: "Pausar" }));
    expect(screen.getByRole("timer")).toHaveTextContent("2:30");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Aeróbico feito · 2 min/ }));
    });
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(body).toMatchObject({ workoutExerciseId: "we7", durationSeconds: 150, reps: null });
    vi.useRealTimers();
  });
});
