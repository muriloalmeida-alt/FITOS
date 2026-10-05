import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SubscriptionGate } from "./SubscriptionGate";

let pathname = "/painel";
vi.mock("next/navigation", () => ({ usePathname: () => pathname, useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/modules/identity/auth-client", () => ({ signOut: vi.fn() }));

describe("SubscriptionGate (EPIC-38)", () => {
  it("carência: faixa com a data e a tela continua", () => {
    pathname = "/painel/alunos";
    render(<SubscriptionGate state={{ kind: "CARENCIA", dateIso: "2026-10-11T15:00:00Z" }} personal><p>Alunos</p></SubscriptionGate>);
    expect(screen.getByRole("status")).toHaveTextContent("Cadastre o cartão até 11/10 para não perder o acesso.");
    expect(screen.getByText("Alunos")).toBeInTheDocument();
  });

  it("bloqueio: troca a tela pelo caminho do cartão, menos em Assinatura", () => {
    pathname = "/painel/alunos";
    const { unmount } = render(<SubscriptionGate state={{ kind: "BLOQUEADO", dateIso: "2026-10-11T15:00:00Z" }} personal><p>Alunos</p></SubscriptionGate>);
    expect(screen.queryByText("Alunos")).toBeNull();
    expect(screen.getByRole("heading", { name: "Cadastre o cartão para continuar" })).toBeInTheDocument();
    expect(screen.getByText(/Seus alunos continuam treinando/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cadastrar cartão" })).toHaveAttribute("href", "/painel/assinatura");
    unmount();

    pathname = "/painel/assinatura";
    render(<SubscriptionGate state={{ kind: "BLOQUEADO", dateIso: "2026-10-11T15:00:00Z" }} personal={false}><p>Assinatura</p></SubscriptionGate>);
    expect(screen.getByText("Assinatura")).toBeInTheDocument();
  });
});
