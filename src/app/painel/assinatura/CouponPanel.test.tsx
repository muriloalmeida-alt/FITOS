import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { CouponPanel } from "./CouponPanel";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const quote = { code: "VOLTA20", summary: "20% de desconto por 3 ciclos. Depois, preço vigente do plano.", planName: "Personal 20", baseCents: 4990, finalCents: 3992, durationCycles: 3, combinedWith: [], revision: "r1" };

describe("CouponPanel", () => {
  afterEach(() => vi.restoreAllMocks());

  it("consulta sem consumir, mostra o preço e só resgata ao confirmar", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => (String(input).endsWith("/previa") ? json(quote) : json({ id: "r1", replayed: false }, 201)));
    render(<CouponPanel coupons={[]} canRedeem />);
    await userEvent.click(screen.getByRole("button", { name: "Tem um cupom?" }));
    await userEvent.type(screen.getByLabelText("Código do cupom"), "volta20");
    await userEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(await screen.findByText(quote.summary)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1]!.body))).toEqual({ code: "VOLTA20" });

    await userEvent.click(screen.getByRole("button", { name: "Confirmar cupom" }));
    const body = JSON.parse(String(fetchMock.mock.calls[1]![1]!.body));
    expect(body).toMatchObject({ code: "VOLTA20", revision: "r1", operationKey: expect.any(String) });
    expect(router.refresh).toHaveBeenCalled();
  });

  it("mostra o erro do servidor e os cupons em vigor", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json({ error: "INELIGIBLE", message: "Este cupom não vale para o seu plano." }, 400));
    render(<CouponPanel coupons={[{ id: "c1", code: "BEMVINDO", summary: "R$ 10,00 de desconto por 1 ciclo.", state: "EM_VIGOR", durationCycles: 1, cyclesUsed: 0 }]} canRedeem />);
    expect(screen.getByText("Em vigor")).toBeInTheDocument();
    expect(screen.getByText("0 de 1 cobrança com desconto")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Tem um cupom?" }));
    await userEvent.type(screen.getByLabelText("Código do cupom"), "outro");
    await userEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(await screen.findByText("Este cupom não vale para o seu plano.")).toBeInTheDocument();
  });
});
