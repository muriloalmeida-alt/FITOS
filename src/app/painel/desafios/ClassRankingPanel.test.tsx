import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { ClassRankingPanel } from "./ClassRankingPanel";

afterEach(() => vi.restoreAllMocks());
const rows = [
  { studentId: "a", name: "Ana", image: null, position: 1, pointsTenths: 105, counted: 3, contested: false, isMe: false },
  { studentId: "b", name: "Bia", image: null, position: 2, pointsTenths: 100, counted: 2, contested: true, isMe: true },
];

describe("ClassRankingPanel", () => {
  it("aluno sem adesão vê as regras e entra; com adesão vê a turma, se reconhece e pode sair", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
    const { rerender } = render(<ClassRankingPanel role="ALUNO" enabled joined={false} period="semana" rows={null} basePath="/painel/desafios?aba=turma" />);
    expect(screen.getByText(/Nunca cargas, programa ou dados de saúde/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Entrar no ranking" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/desafios/turma/participar", expect.objectContaining({ method: "POST" }));
    expect(router.refresh).toHaveBeenCalled();

    rerender(<ClassRankingPanel role="ALUNO" enabled joined period="semana" rows={rows} basePath="/painel/desafios?aba=turma" />);
    expect(screen.getByText("Bia (você)")).toBeInTheDocument();
    expect(screen.getByText("10,5")).toBeInTheDocument();
    expect(screen.getByText("em contestação")).toBeInTheDocument();
    expect(screen.queryByText(/treinos na conta/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Semana" })).toHaveAttribute("aria-current", "page");
    await userEvent.click(screen.getByRole("button", { name: "Sair do ranking" }));
    expect(fetchMock).toHaveBeenLastCalledWith("/api/desafios/turma/participar", expect.objectContaining({ method: "DELETE" }));
  });

  it("personal liga o ranking e vê os treinos na conta; aluno com ranking desligado vê o aviso", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    const { rerender } = render(<ClassRankingPanel role="PERSONAL" enabled={false} joined={false} period="semana" rows={null} basePath="/painel/desafios?aba=turma" />);
    await userEvent.click(screen.getByRole("switch", { name: /Ranking da turma/ }));
    expect(fetchMock).toHaveBeenCalledWith("/api/desafios/turma", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ enabled: true }) }));
    rerender(<ClassRankingPanel role="PERSONAL" enabled joined={false} period="mes" rows={rows} basePath="/painel/desafios?aba=turma" />);
    expect(screen.getByText("3 treinos na conta")).toBeInTheDocument();
    expect(screen.getByText("2 treinos na conta · em contestação")).toBeInTheDocument();
    rerender(<ClassRankingPanel role="ALUNO" enabled={false} joined={false} period="semana" rows={null} basePath="/painel/desafios?aba=turma" />);
    expect(screen.getByText("Seu personal ainda não ligou o ranking da turma.")).toBeInTheDocument();
  });
});
