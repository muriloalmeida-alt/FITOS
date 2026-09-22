import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RegistrarAvaliacaoForm } from "./RegistrarAvaliacaoForm";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

describe("RegistrarAvaliacaoForm (FIT-104)", () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllGlobals();
  });

  it("envia peso, gordura, medidas preenchidas e observação, e atualiza a página", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "a1" }) });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<RegistrarAvaliacaoForm />);

    await user.type(screen.getByLabelText("Peso (kg)"), "82.5");
    await user.type(screen.getByLabelText("% de gordura"), "18.5");
    await user.type(screen.getByLabelText("Cintura (cm)"), "85");
    await user.type(screen.getByLabelText("Observação (opcional)"), "Evolução consistente");
    await user.click(screen.getByRole("button", { name: "Registrar avaliação" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/minhas-avaliacoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        weightKg: 82.5,
        bodyFatPercent: 18.5,
        notes: "Evolução consistente",
        measurementsCm: [{ type: "CINTURA", valueCm: 85 }],
      }),
    });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("envia todos os campos opcionais como null/vazio quando não preenchidos", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "a1" }) });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<RegistrarAvaliacaoForm />);

    await user.click(screen.getByRole("button", { name: "Registrar avaliação" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/minhas-avaliacoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weightKg: null, bodyFatPercent: null, notes: null, measurementsCm: [] }),
    });
  });

  it("mostra mensagem de erro quando a resposta falha", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ message: "O peso deve ser maior que zero." }) });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<RegistrarAvaliacaoForm />);

    await user.click(screen.getByRole("button", { name: "Registrar avaliação" }));

    expect(await screen.findByText("O peso deve ser maior que zero.")).toBeInTheDocument();
  });
});
