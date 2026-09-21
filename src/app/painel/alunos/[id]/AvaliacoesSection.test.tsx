import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AvaliacoesSection, type AssessmentProp } from "./AvaliacoesSection";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

const ASSESSMENT: AssessmentProp = {
  id: "a1",
  recordedAt: "2026-09-01T00:00:00.000Z",
  weightKg: 82.5,
  bodyFatPercent: 18.5,
  notes: "Evolução consistente",
  measurements: [{ type: "CINTURA", valueCm: 85.5 }],
};

describe("AvaliacoesSection (FIT-042)", () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllGlobals();
  });

  it("estado vazio honesto quando não há avaliação registrada", () => {
    render(<AvaliacoesSection studentId="s1" assessments={[]} />);

    expect(screen.getByText("Nenhuma avaliação registrada ainda.")).toBeInTheDocument();
  });

  it("renderiza o histórico com peso, gordura, medidas e observação", () => {
    render(<AvaliacoesSection studentId="s1" assessments={[ASSESSMENT]} />);

    expect(screen.getByText(/82\.5kg/)).toBeInTheDocument();
    expect(screen.getByText(/18\.5% de gordura/)).toBeInTheDocument();
    expect(screen.getByText(/Cintura: 85\.5cm/)).toBeInTheDocument();
    expect(screen.getByText("Evolução consistente")).toBeInTheDocument();
  });

  it("registra uma nova avaliação enviando os valores em kg/cm, sem conversão no cliente", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "a2" }) });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<AvaliacoesSection studentId="s1" assessments={[]} />);

    await user.type(screen.getByLabelText("Peso (kg)"), "80");
    await user.type(screen.getByLabelText("Gordura (%)"), "17");
    await user.type(screen.getByLabelText("Cintura"), "84");
    await user.type(screen.getByLabelText("Observação"), "Primeira avaliação");
    await user.click(screen.getByRole("button", { name: "Registrar avaliação" }));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith("/api/students/s1/avaliacoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        weightKg: 80,
        bodyFatPercent: 17,
        notes: "Primeira avaliação",
        measurements: [{ type: "CINTURA", valueCm: 84 }],
      }),
    });
  });

  it("mostra erro e permite nova tentativa quando o registro falha", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ message: "Aluno não encontrado." }) });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<AvaliacoesSection studentId="s1" assessments={[]} />);

    await user.click(screen.getByRole("button", { name: "Registrar avaliação" }));

    expect(await screen.findByText("Aluno não encontrado.")).toBeInTheDocument();
  });

  it("exclui uma avaliação e atualiza a página", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "a1", deletedAt: new Date().toISOString() }) });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<AvaliacoesSection studentId="s1" assessments={[ASSESSMENT]} />);

    await user.click(screen.getByRole("button", { name: "Excluir" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/students/s1/avaliacoes/a1", { method: "DELETE" });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });
});
