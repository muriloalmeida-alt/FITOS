import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/shared/lib/resizeImage", () => ({ resizeImage: vi.fn(async () => ({ blob: new Blob(["x"]), width: 10, height: 10 })) }));

import { SessionPointsCard } from "./SessionPointsCard";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const points = (status: string, deadline = new Date(Date.now() + 3_600_000).toISOString()) => ({
  points: { totalTenths: 420, balancedTenths: 105, status, photoDeadline: deadline, items: [{ exerciseId: "leg", name: "Leg press", pointsTenths: 110, source: "PRESCRICAO" }] },
});

afterEach(() => vi.restoreAllMocks());

describe("SessionPointsCard (Desafios no fim do treino)", () => {
  it("pendente: foto libera os pontos; detalhe por exercício", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(json(points("PENDENTE_FOTO"))).mockResolvedValueOnce(json({ evidence: { id: "e" } }, 201)).mockResolvedValueOnce(json(points("LIBERADO")));
    render(<SessionPointsCard sessionId="s1" />);
    expect(await screen.findByText("42")).toBeInTheDocument();
    expect(screen.getByText(/Adicione uma foto até .* para receber os pontos/)).toBeInTheDocument();
    await userEvent.upload(screen.getByLabelText("Foto do treino"), new File(["x"], "f.jpg", { type: "image/jpeg" }));
    expect(await screen.findByText("✓ Pontos liberados")).toBeInTheDocument();
    expect(fetchMock.mock.calls[1]![0]).toBe("/api/minhas-sessoes/s1/evidencias");
    await userEvent.click(screen.getByRole("button", { name: "Ver por exercício" }));
    expect(screen.getByText("Leg press")).toBeInTheDocument();
    expect(screen.getByText("11")).toBeInTheDocument();
  });

  it("prazo vencido não oferece foto; sem pontuação (flag desligada) não aparece", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(json(points("PENDENTE_FOTO", "2020-01-01T00:00:00Z")));
    const { unmount } = render(<SessionPointsCard sessionId="s1" />);
    expect(await screen.findByText(/Prazo da foto encerrado/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Adicionar foto/ })).not.toBeInTheDocument();
    unmount();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(json({ error: "NAO_ENCONTRADO" }, 404));
    const { container } = render(<SessionPointsCard sessionId="s2" />);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(container).toBeEmptyDOMElement();
  });
});
