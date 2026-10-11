import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccessGrantPanel, type GrantRow } from "./AccessGrantPanel";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

afterEach(() => vi.restoreAllMocks());

const current = { eligible: true as const, audience: "FitOS Livre", planName: "Livre", access: "BLOQUEADO" as const, freeUntil: null };
const preview = {
  eligible: true,
  startsAt: "2026-10-07T15:00:00.000Z",
  endsAt: "2026-10-22T15:00:00.000Z",
  lastDay: "2026-10-22",
  billing: "Sem cobrança automática ligada.",
  access: "BLOQUEADO",
  freeUntil: null,
  revision: "rev-1",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("AccessGrantPanel (renovação de gratuidade)", () => {
  it("dias + motivo → revisão com datas e cobrança → confirma com a mesma chave e mostra o recibo", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json(preview))
      .mockResolvedValueOnce(json({ grant: { id: "g1", days: 15, lastDay: "2026-10-22" }, replayed: false }, 201));
    render(<AccessGrantPanel userId="u1" current={current} history={[]} />);
    expect(screen.getByText(/FitOS Livre · Livre · acesso bloqueado/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("radio", { name: "+15 dias" }));
    await userEvent.click(screen.getByRole("button", { name: "Revisar" }));
    expect(screen.getByText("Escolha o motivo.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("radio", { name: "Suporte" }));
    await userEvent.click(screen.getByRole("button", { name: "Revisar" }));
    const review = await screen.findByLabelText("Revisão da gratuidade");
    expect(within(review).getByText("22/10/2026 (último dia incluído)")).toBeInTheDocument();
    expect(within(review).getByText("Sem cobrança automática ligada.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith("/api/admin/usuarios/u1/gratuidade/previa", expect.objectContaining({ body: JSON.stringify({ days: 15 }) }));

    await userEvent.click(screen.getByRole("button", { name: "Confirmar gratuidade" }));
    const sent = JSON.parse(String(fetchMock.mock.calls[1]![1]!.body));
    expect(sent).toMatchObject({ days: 15, reasonCode: "SUPORTE", revision: "rev-1" });
    expect(sent.operationKey).toMatch(/^[0-9a-f-]{36}$/);
    expect(await screen.findByText("Gratuidade concedida: 15 dias, acesso gratuito até 22/10/2026.")).toBeInTheDocument();
    expect(router.refresh).toHaveBeenCalled();
  });

  it("Outro exige descrição; prévia velha (409) volta para o formulário com o aviso", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json(preview))
      .mockResolvedValueOnce(json({ error: "CONFLITO", message: "A assinatura mudou desde a prévia. Revise de novo antes de confirmar." }, 409));
    render(<AccessGrantPanel userId="u1" current={current} history={[]} />);
    await userEvent.click(screen.getByRole("radio", { name: "Outro" }));
    await userEvent.click(screen.getByRole("button", { name: "Revisar" }));
    expect(screen.getByText("Descreva o motivo.")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Descreva o motivo"), "Parceria com academia");
    await userEvent.click(screen.getByRole("button", { name: "Revisar" }));
    await userEvent.click(await screen.findByRole("button", { name: "Confirmar gratuidade" }));
    expect(await screen.findByText(/A assinatura mudou desde a prévia/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Revisar" })).toBeInTheDocument();
  });

  it("não elegível: mostra o motivo e só o histórico; revogar pede motivo", async () => {
    const history: GrantRow[] = [
      { id: "g1", days: 30, startsAt: "2026-10-20T15:00:00.000Z", lastDay: "2026-11-19", status: "AGENDADO", reasonCode: "LANCAMENTO", reasonText: null, revokeReason: null },
      { id: "g0", days: 7, startsAt: "2026-08-01T15:00:00.000Z", lastDay: "2026-08-08", status: "REVOGADO", reasonCode: "OUTRO", reasonText: "teste", revokeReason: "engano" },
    ];
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(json({ grant: { id: "g1", state: "REVOKED" } }));
    render(<AccessGrantPanel userId="u1" current={{ eligible: false, message: "O plano atual já é gratuito." }} history={history} />);
    expect(screen.getByText("O plano atual já é gratuito.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Revisar" })).not.toBeInTheDocument();
    expect(screen.getByText("Agendado")).toBeInTheDocument();
    expect(screen.getByText(/Outro: teste · revogado: engano/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Revogar" }));
    await userEvent.click(screen.getByRole("button", { name: "Revogar gratuidade" }));
    expect(screen.getByText("Descreva o motivo da revogação.")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Motivo da revogação"), "pedido do usuário");
    await userEvent.click(screen.getByRole("button", { name: "Revogar gratuidade" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/gratuidade/g1/revogar", expect.objectContaining({ body: JSON.stringify({ reason: "pedido do usuário" }) }));
    expect(router.refresh).toHaveBeenCalled();
  });
});
