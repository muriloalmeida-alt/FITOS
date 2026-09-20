import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessaoExecucao, type SessionItemProp } from "./SessaoExecucao";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const ITEM: SessionItemProp = {
  id: "i1",
  exerciseName: "Supino",
  exerciseMuscle: "Peito",
  instructions: "Manter os cotovelos a 45 graus.",
  sets: 3,
  reps: 10,
  durationSeconds: null,
  load: "20kg",
  restSeconds: 60,
  notes: "Foco na execução",
  result: null,
};

describe("SessaoExecucao (FIT-041)", () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllGlobals();
  });

  it("renderiza o item com parâmetros, notas e instruções legíveis", () => {
    render(<SessaoExecucao sessionId="sess1" items={[ITEM]} />);

    expect(screen.getByText("Supino")).toBeInTheDocument();
    expect(screen.getByText("Peito")).toBeInTheDocument();
    expect(screen.getByText(/3 séries.*10 repetições.*carga: 20kg.*descanso: 60s/)).toBeInTheDocument();
    expect(screen.getByText("Foco na execução")).toBeInTheDocument();
    expect(screen.getByText("Manter os cotovelos a 45 graus.")).toBeInTheDocument();
  });

  it("estado vazio honesto quando o treino não tem exercícios", () => {
    render(<SessaoExecucao sessionId="sess1" items={[]} />);

    expect(screen.getByText("Este treino ainda não tem exercícios.")).toBeInTheDocument();
  });

  it("'Repetir prescrito' preenche os campos com os valores prescritos", async () => {
    const user = userEvent.setup();
    render(<SessaoExecucao sessionId="sess1" items={[ITEM]} />);

    await user.click(screen.getByRole("button", { name: "Repetir prescrito" }));

    expect(screen.getByLabelText("Séries executadas")).toHaveValue(3);
    expect(screen.getByLabelText("Repetições executadas")).toHaveValue(10);
    expect(screen.getByLabelText("Carga utilizada")).toHaveValue("20kg");
  });

  it("'Salvar resultado' envia o resultado e mostra o selo 'Salvo'", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "r1" }) });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<SessaoExecucao sessionId="sess1" items={[ITEM]} />);

    await user.type(screen.getByLabelText("Séries executadas"), "3");
    await user.click(screen.getByRole("button", { name: "Salvar resultado" }));

    await waitFor(() => expect(screen.getByText("Salvo")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith("/api/workout-sessions/sess1/resultados", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workoutExerciseId: "i1",
        setsCompleted: 3,
        repsCompleted: null,
        durationSecondsCompleted: null,
        loadUsed: null,
      }),
    });
  });

  it("mostra erro e permite nova tentativa quando salvar falha", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ message: "Sessão já concluída." }) });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<SessaoExecucao sessionId="sess1" items={[ITEM]} />);

    await user.click(screen.getByRole("button", { name: "Salvar resultado" }));

    expect(await screen.findByText("Sessão já concluída.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar resultado" })).not.toBeDisabled();
  });

  it("mostra falha de conexão quando o fetch de salvar lança", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("network error"));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<SessaoExecucao sessionId="sess1" items={[ITEM]} />);

    await user.click(screen.getByRole("button", { name: "Salvar resultado" }));

    expect(await screen.findByText(/Falha de conexão/)).toBeInTheDocument();
  });

  it("temporizador de descanso: inicia, conta e pode ser pulado sem bloquear outros controles", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup();
    render(<SessaoExecucao sessionId="sess1" items={[ITEM]} />);

    await user.click(screen.getByRole("button", { name: "Iniciar descanso (60s)" }));
    expect(screen.getByText("60s")).toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(3000);
    expect(screen.getByText("57s")).toBeInTheDocument();
    // Outros controles continuam disponíveis — não é bloqueante.
    expect(screen.getByRole("button", { name: "Repetir prescrito" })).not.toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Pular descanso" }));
    expect(screen.queryByText("57s")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Iniciar descanso (60s)" })).toBeInTheDocument();

    vi.useRealTimers();
  });

  it("'Concluir treino' envia a conclusão e navega para /painel", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "CONCLUIDA" }) });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<SessaoExecucao sessionId="sess1" items={[ITEM]} />);

    await user.click(screen.getByRole("button", { name: "Concluir treino" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/workout-sessions/sess1/concluir", { method: "POST" });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/painel"));
  });

  it("'Abandonar treino' envia o abandono e navega para /painel", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "ABANDONADA" }) });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<SessaoExecucao sessionId="sess1" items={[ITEM]} />);

    await user.click(screen.getByRole("button", { name: "Abandonar treino" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/workout-sessions/sess1/abandonar", { method: "POST" });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/painel"));
  });
});
