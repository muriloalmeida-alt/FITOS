import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkoutRunner, adjustLoad, formatClock, type RunnerItem } from "./WorkoutRunner";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const SUPINO: RunnerItem = {
  id: "i1",
  exerciseName: "Supino",
  exerciseMuscle: "Peito",
  instructions: "Manter os cotovelos a 45 graus.",
  sets: 2,
  reps: 10,
  durationSeconds: null,
  load: "20 kg",
  restSeconds: 60,
  notes: "Foco na execução",
  result: null,
};

const REMADA: RunnerItem = {
  id: "i2",
  exerciseName: "Remada curvada",
  exerciseMuscle: "Costas",
  instructions: null,
  sets: 3,
  reps: 12,
  durationSeconds: null,
  load: null,
  restSeconds: null,
  notes: null,
  result: null,
};

function renderRunner(overrides: Partial<Parameters<typeof WorkoutRunner>[0]> = {}) {
  return render(
    <WorkoutRunner
      sessionId="sess1"
      workoutName="Treino A"
      startedAt={new Date().toISOString()}
      items={[SUPINO, REMADA]}
      mode="student"
      apiBase="/api/workout-sessions"
      exitHref="/painel"
      {...overrides}
    />
  );
}

describe("WorkoutRunner (AjustesTreinoAluno/AjustesTreinoLivre)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllGlobals();
  });

  it("mostra exercício atual, posição, prescrição do Personal e próximo exercício", () => {
    renderRunner();

    expect(screen.getByRole("heading", { name: "Supino" })).toBeInTheDocument();
    expect(screen.getByText("01 / 02")).toBeInTheDocument();
    expect(screen.getByText(/Prescrito pelo seu Personal/)).toBeInTheDocument();
    expect(screen.getByText("20 kg")).toBeInTheDocument();
    expect(screen.getByText("carga prevista")).toBeInTheDocument();
    expect(screen.getByText("60 s")).toBeInTheDocument();
    expect(screen.getByText("Próximo: Remada curvada")).toBeInTheDocument();
    expect(screen.getByText("Foco na execução")).toBeInTheDocument();
  });

  it("estado vazio honesto quando o treino não tem exercícios", () => {
    renderRunner({ items: [] });
    expect(screen.getByText("Este treino ainda não tem exercícios.")).toBeInTheDocument();
  });

  it("'Concluir série' grava o realizado no contrato existente e inicia o descanso", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "r1" }) });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderRunner();

    await user.click(screen.getByRole("button", { name: "Concluir série" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/workout-sessions/sess1/resultados");
    expect(JSON.parse(init.body)).toEqual({
      workoutExerciseId: "i1",
      setsCompleted: 1,
      repsCompleted: 10,
      durationSecondsCompleted: null,
      loadUsed: "20 kg",
    });
    expect(await screen.findByText("Pular descanso")).toBeInTheDocument();
    expect(screen.getByText("2 de 2")).toBeInTheDocument();
  });

  it("ao concluir a última série do exercício, avança para o próximo", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    const user = userEvent.setup();
    renderRunner({ items: [{ ...SUPINO, result: { setsCompleted: 1, repsCompleted: 10, durationSecondsCompleted: null, loadUsed: "20 kg" } }, REMADA] });

    await user.click(screen.getByRole("button", { name: "Concluir série" }));

    expect(await screen.findByRole("heading", { name: "Remada curvada" })).toBeInTheDocument();
  });

  it("'Pular descanso' encerra a contagem sem concluir série", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    const user = userEvent.setup();
    renderRunner();

    await user.click(screen.getByRole("button", { name: "Concluir série" }));
    await user.click(await screen.findByRole("button", { name: "Pular descanso" }));

    expect(screen.queryByRole("button", { name: "Pular descanso" })).not.toBeInTheDocument();
    expect(screen.getByText("2 de 2")).toBeInTheDocument();
  });

  it("falha ao registrar mostra erro legível e não avança a série", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ message: "Sessão encerrada." }) }));
    const user = userEvent.setup();
    renderRunner();

    await user.click(screen.getByRole("button", { name: "Concluir série" }));

    expect(await screen.findByText("Sessão encerrada.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pular descanso" })).not.toBeInTheDocument();
    expect(screen.getByText("Série atual")).toBeInTheDocument();
  });

  it("pausar o relógio persiste o estado neste aparelho e não conclui série", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderRunner();

    await user.click(await screen.findByRole("button", { name: "Pausar tempo de treino" }));

    expect(screen.getByRole("button", { name: "Iniciar tempo de treino" })).toBeInTheDocument();
    expect(screen.getByText("Relógio pausado")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    const stored = JSON.parse(window.localStorage.getItem("fitos:sessao:sess1") ?? "null");
    expect(stored.clock.runningSince).toBeNull();
  });

  it("retoma o relógio salvo ao voltar para a sessão", async () => {
    window.localStorage.setItem(
      "fitos:sessao:sess1",
      JSON.stringify({ clock: { accumulatedMs: 125_000, runningSince: null }, index: 1, restEndsAt: null })
    );
    renderRunner();

    expect(await screen.findByText("02:05")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Remada curvada" })).toBeInTheDocument();
  });

  it("áudio só oferece abrir apps externos, sem conectar contas", async () => {
    const user = userEvent.setup();
    renderRunner();

    await user.click(screen.getByRole("button", { name: /Áudio durante o treino/ }));

    expect(screen.getByRole("link", { name: "Abrir Spotify" })).toHaveAttribute("href", "https://open.spotify.com");
    expect(screen.getByRole("link", { name: "Abrir Apple Music" })).toHaveAttribute("href", "https://music.apple.com");
    expect(screen.getByText(/Nenhuma conta é conectada/)).toBeInTheDocument();
  });

  it("abandonar pede confirmação e só chama a API após confirmar", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    const confirmMock = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
    vi.stubGlobal("confirm", confirmMock);
    const user = userEvent.setup();
    renderRunner();

    await user.click(screen.getByRole("button", { name: "Abandonar treino" }));
    expect(fetchMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Abandonar treino" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/workout-sessions/sess1/abandonar", { method: "POST" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/painel"));
  });

  it("concluir com ajustes não registrados pede confirmação", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(false));
    const user = userEvent.setup();
    renderRunner();

    await user.click(screen.getByRole("button", { name: "Alterar" }));
    await user.clear(screen.getByLabelText("Repetições realizadas"));
    await user.type(screen.getByLabelText("Repetições realizadas"), "8");
    await user.click(screen.getByRole("button", { name: "Concluir treino" }));

    expect(window.confirm).toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("FitOS Livre: ajuste rápido de carga e atalho para editar a sequência", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    renderRunner({ mode: "individual", apiBase: "/api/minhas-sessoes", exitHref: "/painel/meus-treinos", workoutId: "w1" });

    expect(screen.getByText(/Seu treino · ajuste a carga/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Aumentar carga" }));
    expect(screen.getAllByText("22,5 kg").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Concluir série" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/minhas-sessoes/sess1/resultados");
    expect(JSON.parse(init.body).loadUsed).toBe("22,5 kg");
    expect(screen.getByRole("link", { name: "Editar sequência do treino" })).toHaveAttribute("href", "/painel/meus-treinos/w1");
  });

  it("formatClock e adjustLoad", () => {
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(1_122_000)).toBe("18:42");
    expect(formatClock(3_725_000)).toBe("1:02:05");
    expect(adjustLoad("40 kg", 2.5)).toBe("42,5 kg");
    expect(adjustLoad("42,5 kg", -2.5)).toBe("40 kg");
    expect(adjustLoad("elástico leve", 2.5)).toBe("elástico leve");
    expect(adjustLoad("", 2.5)).toBe("2,5 kg");
  });
});
