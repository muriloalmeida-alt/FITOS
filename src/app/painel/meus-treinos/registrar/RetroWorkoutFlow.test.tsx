import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/shared/lib/resizeImage", () => ({ resizeImage: vi.fn(async () => ({ blob: new Blob(["x"], { type: "image/jpeg" }), width: 1200, height: 1600 })) }));

import { RetroWorkoutFlow } from "./RetroWorkoutFlow";

const library = [
  { id: "leg", name: "Leg Press 45°", muscle: "Quadríceps", imageUrl: null, imageAlt: null, type: "Máquina" },
  { id: "bike", name: "Bicicleta", muscle: "Aeróbico", imageUrl: null, imageAlt: null, type: "Aeróbico" },
];
const nowIso = "2026-10-11T15:00:00.000Z";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

afterEach(() => vi.restoreAllMocks());
URL.createObjectURL = vi.fn(() => "blob:preview");
URL.revokeObjectURL = vi.fn();

async function addLegPress() {
  await userEvent.click(screen.getByRole("button", { name: "+ Adicionar exercício" }));
  await userEvent.click(screen.getByRole("button", { name: /Leg Press 45°/ }));
  await userEvent.click(screen.getByRole("button", { name: /^Adicionar/ }));
}

describe("RetroWorkoutFlow (registrar treino realizado)", () => {
  it("data, execução, duração, foto e revisão; envia uma vez com chave única e anexa a foto", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date(nowIso) });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(json({ sessionId: "s1", replayed: false, possibleDuplicate: false }, 201)).mockResolvedValueOnce(json({ evidence: { id: "e1" } }, 201));
    render(<RetroWorkoutFlow library={library} nowIso={nowIso} pointsEnabled />);

    expect(screen.getByText("Registro retroativo · até 7 dias")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByText("Adicione pelo menos um exercício.")).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText("Data"));
    await userEvent.type(screen.getByLabelText("Data"), "2026-10-07");
    await userEvent.clear(screen.getByLabelText("Horário"));
    await userEvent.type(screen.getByLabelText("Horário"), "18:30");
    await addLegPress();
    for (const set of [1, 2, 3]) await userEvent.type(screen.getByLabelText(`Carga da série ${set} de Leg Press 45°`), "30");
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));

    expect(screen.getByText("Quanto tempo durou o treino inteiro?")).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText("Minutos"));
    await userEvent.click(screen.getByRole("button", { name: "Continuar para foto" }));
    expect(screen.getByText("Informe quanto tempo durou o treino.")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Minutos"), "45");
    await userEvent.click(screen.getByRole("button", { name: "Continuar para foto" }));

    expect(screen.getByText("A foto é obrigatória para receber pontos. Você pode salvar o treino sem pontuar.")).toBeInTheDocument();
    await userEvent.upload(screen.getByLabelText("Foto do treino"), new File(["x"], "treino.jpg", { type: "image/jpeg" }));
    expect(await screen.findByAltText("Foto escolhida para o treino")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));

    expect(screen.getByText("45 min")).toBeInTheDocument();
    expect(screen.getByText("3 × 10 × 30 kg · Volume: 900 kg")).toBeInTheDocument();
    expect(screen.getByText("✓ Foto anexada")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Concluir registro" }));

    expect(await screen.findByRole("heading", { name: "Treino registrado" })).toBeInTheDocument();
    const sent = JSON.parse(String(fetchMock.mock.calls[0]![1]!.body));
    expect(sent).toMatchObject({ performedAt: "2026-10-07T21:30:00.000Z", durationSeconds: 2700, exercises: [{ exerciseId: "leg", sets: [1, 2, 3].map(() => ({ reps: 10, loadKg: 30 })) }] });
    expect(sent.operationKey).toMatch(/^[0-9a-f-]{36}$/);
    expect(fetchMock.mock.calls[1]![0]).toBe("/api/minhas-sessoes/s1/evidencias");
    vi.useRealTimers();
  });

  it("foto que falha: treino salvo e opção de enviar de novo; data fora do prazo é recusada", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json({ sessionId: "s2", replayed: false, possibleDuplicate: true }, 201))
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValueOnce(json({ evidence: { id: "e2" } }, 201));
    render(<RetroWorkoutFlow library={library} nowIso={new Date().toISOString()} pointsEnabled />);
    await userEvent.clear(screen.getByLabelText("Data"));
    await userEvent.type(screen.getByLabelText("Data"), "2020-01-01");
    await addLegPress();
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByText("Só dá para registrar treinos de até 7 dias atrás.")).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText("Data"));
    await userEvent.type(screen.getByLabelText("Data"), new Date(Date.now() - 86_400_000).toISOString().slice(0, 10));
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
    await userEvent.click(screen.getByRole("button", { name: "Continuar para foto" }));
    await userEvent.upload(screen.getByLabelText("Foto do treino"), new File(["x"], "treino.jpg", { type: "image/jpeg" }));
    await screen.findByAltText("Foto escolhida para o treino");
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
    await userEvent.click(screen.getByRole("button", { name: "Concluir registro" }));

    expect(await screen.findByText(/Treino salvo, mas a foto não foi enviada/)).toBeInTheDocument();
    expect(screen.getByText(/Já existe um treino perto desse horário/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Tentar enviar a foto de novo" }));
    expect(await screen.findByText("✓ Foto anexada")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("aeróbico registra minutos; sem foto segue sem pontuação", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(json({ sessionId: "s3", replayed: false, possibleDuplicate: false }, 201));
    render(<RetroWorkoutFlow library={library} nowIso={new Date().toISOString()} pointsEnabled={false} />);
    await userEvent.click(screen.getByRole("button", { name: "+ Adicionar exercício" }));
    await userEvent.click(screen.getByRole("button", { name: /Bicicleta/ }));
    await userEvent.click(screen.getByRole("button", { name: /^Adicionar/ }));
    expect(screen.getByLabelText("Minutos da série 1 de Bicicleta")).toHaveValue("20");
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
    await userEvent.click(screen.getByRole("button", { name: "Continuar para foto" }));
    await userEvent.click(screen.getByRole("button", { name: "Continuar sem foto" }));
    expect(screen.getByText("Sem foto.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Concluir registro" }));
    expect(await screen.findByText("Salvo sem foto.")).toBeInTheDocument();
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1]!.body)).exercises).toEqual([{ exerciseId: "bike", sets: [{ durationSeconds: 1200 }] }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
