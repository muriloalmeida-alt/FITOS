import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/shared/lib/resizeImage", () => ({ resizeImage: vi.fn(async () => ({ blob: new Blob(["x"], { type: "image/jpeg" }), width: 1200, height: 1600 })) }));

import { RetroWorkoutFlow } from "./RetroWorkoutFlow";

const library = [
  { id: "leg", name: "Leg Press 45°", muscle: "Quadríceps", imageUrl: null, imageAlt: null, type: "Máquina" },
  { id: "bike", name: "Bicicleta", muscle: "Aeróbico", imageUrl: null, imageAlt: null, type: "Aeróbico" },
];
const nowIso = "2026-10-11T15:00:00.000Z";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/// Responde por rota; `evidence` é a fila de respostas do envio da foto.
function routes(register: Response, evidence: (() => Promise<Response>)[]) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.endsWith("/retroativo/previa")) return json({ totalTenths: 100, items: [] });
    if (url.endsWith("/retroativo")) return register;
    if (url.includes("/evidencias")) return evidence.shift()!();
    if (url.includes("/pontos")) return json({ points: null });
    throw new Error(`inesperado: ${url}`);
  });
}

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
    const fetchMock = routes(json({ sessionId: "s1", replayed: false, possibleDuplicate: false }, 201), [async () => json({ evidence: { id: "e1" } }, 201)]);
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
    expect(await screen.findByText("10 pontos")).toBeInTheDocument();
    expect(screen.getByText("Este treino renderá")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Concluir e receber pontos" }));

    expect(await screen.findByRole("heading", { name: "Treino registrado" })).toBeInTheDocument();
    const registerCall = fetchMock.mock.calls.find((call) => String(call[0]).endsWith("/retroativo"))!;
    const sent = JSON.parse(String(registerCall[1]!.body));
    expect(sent).toMatchObject({ performedAt: "2026-10-07T21:30:00.000Z", durationSeconds: 2700, exercises: [{ exerciseId: "leg", sets: [1, 2, 3].map(() => ({ reps: 10, loadKg: 30 })) }] });
    expect(sent.operationKey).toMatch(/^[0-9a-f-]{36}$/);
    expect(fetchMock.mock.calls.some((call) => call[0] === "/api/minhas-sessoes/s1/evidencias")).toBe(true);
    vi.useRealTimers();
  });

  it("foto que falha: treino salvo e opção de enviar de novo; data fora do prazo é recusada", async () => {
    const fetchMock = routes(json({ sessionId: "s2", replayed: false, possibleDuplicate: true }, 201), [async () => Promise.reject(new TypeError("offline")), async () => json({ evidence: { id: "e2" } }, 201)]);
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
    await userEvent.click(screen.getByRole("button", { name: "Concluir e receber pontos" }));

    expect(await screen.findByText(/Treino salvo, mas a foto não foi enviada/)).toBeInTheDocument();
    expect(screen.getByText(/Já existe um treino perto desse horário/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Tentar enviar a foto de novo" }));
    expect(await screen.findByText("✓ Foto anexada")).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter((call) => String(call[0]).includes("/evidencias"))).toHaveLength(2);
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

  it("edição: começa com o registro, pula a foto, salva com PUT e volta ao detalhe", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date(nowIso) });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/retroativo/previa")) return json({ totalTenths: 110, items: [] });
      if (url.endsWith("/s9/registro")) return json({ sessionId: "s9" });
      throw new Error(`inesperado: ${url}`);
    });
    render(
      <RetroWorkoutFlow
        library={library}
        nowIso={nowIso}
        pointsEnabled
        edit={{ sessionId: "s9", performedAtIso: "2026-10-09T21:30:00.000Z", durationSeconds: 3000, items: [{ exercise: library[0]!, sets: [{ reps: 10, loadKg: 30, durationSeconds: null }] }] }}
      />
    );
    expect(screen.getByLabelText("Data")).toHaveValue("2026-10-09");
    expect(screen.getByLabelText("Horário")).toHaveValue("18:30");
    expect(screen.getByLabelText("Carga da série 1 de Leg Press 45°")).toHaveValue("30");
    await userEvent.clear(screen.getByLabelText("Carga da série 1 de Leg Press 45°"));
    await userEvent.type(screen.getByLabelText("Carga da série 1 de Leg Press 45°"), "33");
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByLabelText("Minutos")).toHaveValue("50");
    await userEvent.click(screen.getByRole("button", { name: "Revisar alterações" }));

    expect(await screen.findByText("Com a edição, este treino renderá")).toBeInTheDocument();
    expect(screen.queryByText("Adicione uma foto para receber os pontos.")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/registro"))!;
    expect(call[1]).toMatchObject({ method: "PUT" });
    expect(JSON.parse(String(call[1]!.body))).toEqual({ performedAt: "2026-10-09T21:30:00.000Z", durationSeconds: 3000, exercises: [{ exerciseId: "leg", sets: [{ reps: 10, loadKg: 33 }] }] });
    expect(router.push).toHaveBeenCalledWith("/painel/treinos-realizados/s9");
    vi.useRealTimers();
  });
});
