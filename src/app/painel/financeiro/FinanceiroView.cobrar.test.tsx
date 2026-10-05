import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { ToastProvider } from "@/shared/ui";
import { FinanceiroView, type FinanceCharge } from "./FinanceiroView";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const charge: FinanceCharge = { id: "c1", studentId: "s1", studentName: "Ana Costa", description: "Mensalidade", amountCents: 15000, dueDate: "2026-10-10T15:00:00.000Z", status: "PENDENTE", cancelReason: null, paidAt: null, paidCents: null, method: null, paymentUrl: null, hasCpf: false };

function renderView(canChargeOnline: boolean) {
  render(
    <ToastProvider>
      <FinanceiroView monthKey="2026-10" monthLabel="outubro de 2026" summary={{ recebidoCents: 0, pendenteCents: 15000, atrasadoCents: 0 }} charges={[charge]} recurrences={[]} students={[]} pendingRecurrences={0} tab="cobrancas" startNew={false} canChargeOnline={canChargeOnline} />
    </ToastProvider>
  );
}

describe("Cobrar pelo app (EPIC-38)", () => {
  it("sem conta Asaas conectada, não aparece", () => {
    renderView(false);
    expect(screen.queryByRole("button", { name: "Cobrar Ana Costa pelo app" })).toBeNull();
  });

  it("pede o CPF na primeira vez e mostra Pix e WhatsApp com o link", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ paymentUrl: "https://www.asaas.com/i/abc", pixPayload: "000201PIX" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    renderView(true);
    fireEvent.click(screen.getByRole("button", { name: "Cobrar Ana Costa pelo app" }));
    const sheet = screen.getByRole("dialog", { name: "Cobrar Ana" });
    expect(within(sheet).getByRole("button", { name: "Gerar cobrança" })).toBeDisabled();
    fireEvent.change(within(sheet).getByLabelText("CPF do aluno"), { target: { value: "529.982.247-25" } });
    await act(async () => {
      fireEvent.click(within(sheet).getByRole("button", { name: "Gerar cobrança" }));
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/cobrancas/c1/link", expect.objectContaining({ method: "POST", body: JSON.stringify({ cpf: "529.982.247-25" }) }));
    expect(within(sheet).getByRole("button", { name: "Copiar Pix copia e cola" })).toBeInTheDocument();
    expect(within(sheet).getByRole("link", { name: "Mandar o link no WhatsApp" }).getAttribute("href")).toContain(encodeURIComponent("https://www.asaas.com/i/abc"));
    vi.unstubAllGlobals();
  });
});
