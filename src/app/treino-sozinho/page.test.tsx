import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import TreinoSozinhoPage from "./page";

const plans = vi.hoisted(() => ({ list: [{ id: "livre", priceCents: 1990, billingCycle: "MENSAL", trialDays: 30 }] as unknown[] }));
vi.mock("@/modules/billing/plans", () => ({ listActivePlansForAudience: vi.fn(async () => plans.list) }));

describe("FitOS Livre (FIT-169)", () => {
  it("o que pode, o que não é, preço real e CTA para o caminho Livre", async () => {
    render(await TreinoSozinhoPage());
    expect(screen.getByRole("heading", { level: 1, name: "Seu treino, por conta própria." })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "O que você pode fazer" })).toBeInTheDocument();
    expect(screen.getByText(/Não substitui um personal/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s19,90/)).toBeInTheDocument();
    expect(screen.getByText("30 dias grátis para testar. Cancele quando quiser.")).toBeInTheDocument();
    const ctas = screen.getAllByRole("link", { name: "Começar 30 dias grátis" });
    expect(ctas).toHaveLength(2);
    for (const cta of ctas) expect(cta).toHaveAttribute("href", "/comecar?caminho=livre");
    expect(screen.getByRole("link", { name: "Entre com o convite" })).toHaveAttribute("href", "/comecar?caminho=convite");
  });

  it("sem plano ativo, esconde o preço e mantém o CTA", async () => {
    plans.list = [];
    render(await TreinoSozinhoPage());
    expect(screen.queryByRole("heading", { name: "Quanto custa" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Começar agora" })).toHaveAttribute("href", "/comecar?caminho=livre");
  });
});
