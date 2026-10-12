import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SignupCouponField, couponNotice, type SignupCoupon } from "./SignupCouponField";

function Harness({ onPending }: { onPending: (pending: boolean) => void }) {
  const [value, setValue] = useState<SignupCoupon | null>(null);
  return <SignupCouponField product="INDIVIDUAL" value={value} onChange={setValue} onPendingChange={onPending} />;
}

describe("SignupCouponField", () => {
  it("abre, confere o código e mostra o desconto aplicado", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ code: "BEMVINDO", summary: "20% de desconto por 2 ciclos. Depois, preço vigente do plano." }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const pending = vi.fn();
    render(<Harness onPending={pending} />);
    await userEvent.click(screen.getByRole("button", { name: "Tem um cupom de desconto?" }));
    await userEvent.type(screen.getByLabelText("Cupom de desconto"), "bemvindo");
    expect(pending).toHaveBeenLastCalledWith(true);
    await userEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body))).toEqual({ code: "BEMVINDO", product: "INDIVIDUAL" });
    expect(screen.getByRole("status").textContent).toContain("Cupom BEMVINDO aplicado");
    expect(pending).toHaveBeenLastCalledWith(false);
    vi.unstubAllGlobals();
  });

  it("código inválido mostra o motivo", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ message: "Cupom não encontrado. Confira o código." }), { status: 400 })));
    render(<Harness onPending={() => undefined} />);
    await userEvent.click(screen.getByRole("button", { name: "Tem um cupom de desconto?" }));
    await userEvent.type(screen.getByLabelText("Cupom de desconto"), "xyz");
    await userEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(screen.getByText("Cupom não encontrado. Confira o código.")).toBeTruthy();
    vi.unstubAllGlobals();
  });

  it("aviso quando a conta foi criada sem o cupom", () => {
    expect(couponNotice({ applied: false, message: "As vagas deste cupom acabaram." })).toBe("Sua conta foi criada, mas o cupom não foi aplicado: As vagas deste cupom acabaram.");
    expect(couponNotice({ applied: true })).toBeNull();
    expect(couponNotice(null)).toBeNull();
  });
});
