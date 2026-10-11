import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BlockPanel, type BlockResultView } from "./BlockPanel";
import { parseBlock } from "@/shared/lib/workoutBlocks";

const amrap = parseBlock({ key: "b1", kind: "AMRAP", windowSeconds: 600, name: "WOD" });
const base: BlockResultView = { blockKey: "b1", startedAt: null, pausedAt: null, pausedSeconds: 0, endedAt: null, outcome: null, roundsCompleted: null, partialReps: null, intervalsCompleted: null, elapsedSeconds: null, note: null };

function reply(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } }));
}

describe("BlockPanel", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("inicia o timer no servidor e avisa a tela", async () => {
    const fetchMock = vi.fn(() => reply({ ...base, startedAt: new Date().toISOString() }));
    vi.stubGlobal("fetch", fetchMock);
    const onChange = vi.fn();
    render(<BlockPanel block={amrap} initial={null} endpoint="/api/x/s1/blocos/b1" onChange={onChange} />);
    expect(screen.getByText("10:00")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Iniciar bloco" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/x/s1/blocos/b1/timer", expect.objectContaining({ method: "POST", body: JSON.stringify({ action: "INICIAR" }) }));
    expect(await screen.findByRole("button", { name: "Pausar" })).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ blockKey: "b1" }));
  });

  it("encerra com as voltas informadas, sem assumir a meta", async () => {
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => reply({ ...base, startedAt: "2026-10-11T10:00:00Z", endedAt: "2026-10-11T10:10:00Z", outcome: "PARCIAL", ...JSON.parse(String(init?.body)) }));
    vi.stubGlobal("fetch", fetchMock);
    render(<BlockPanel block={amrap} initial={{ ...base, startedAt: new Date().toISOString() }} endpoint="/api/x/s1/blocos/b1" />);
    await userEvent.click(screen.getByRole("button", { name: "Encerrar bloco" }));
    await userEvent.click(screen.getByRole("button", { name: "Salvar resultado" }));
    const body = JSON.parse(String(fetchMock.mock.calls[0]![1]!.body));
    expect(body).toMatchObject({ roundsCompleted: 0, intervalsCompleted: null });
    expect(await screen.findByRole("button", { name: "Corrigir resultado" })).toBeInTheDocument();
  });

  it("mostra o resultado já salvo", () => {
    render(<BlockPanel block={amrap} initial={{ ...base, startedAt: "2026-10-11T10:00:00Z", endedAt: "2026-10-11T10:10:00Z", outcome: "PARCIAL", roundsCompleted: 5, partialReps: 8 }} endpoint="/x" />);
    expect(screen.getByText("5 voltas + 8 reps")).toBeInTheDocument();
  });
});
