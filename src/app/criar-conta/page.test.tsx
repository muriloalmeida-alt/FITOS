import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import CriarContaPage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

function makeSearchParams(params: Record<string, string> = {}) {
  return Promise.resolve(params);
}

describe("CriarContaPage (FIT-112)", () => {
  it("sem ?modo=: mostra a etapa 1 (os três caminhos), nunca o formulário de personal direto", async () => {
    render(await CriarContaPage({ searchParams: makeSearchParams() }));

    expect(screen.getByText("Passo 1 de 2")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sou Personal" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tenho convite do meu personal" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "FitOS Livre" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Nome completo")).not.toBeInTheDocument();
  });

  it("?modo= com valor não reconhecido: volta para a etapa 1, nunca cai num formulário por engano", async () => {
    render(await CriarContaPage({ searchParams: makeSearchParams({ modo: "qualquer-coisa" }) }));

    expect(screen.getByText("Passo 1 de 2")).toBeInTheDocument();
    expect(screen.queryByLabelText("Nome completo")).not.toBeInTheDocument();
  });

  it("?modo=personal: mostra a etapa 2 com o formulário de personal", async () => {
    render(await CriarContaPage({ searchParams: makeSearchParams({ modo: "personal" }) }));

    expect(screen.getByText("Passo 2 de 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Nome completo")).toBeInTheDocument();
    expect(screen.getByText(/destinado a personal trainers/)).toBeInTheDocument();
  });

  it("?modo=individual: mostra a etapa 2 com o formulário do FitOS Livre", async () => {
    render(await CriarContaPage({ searchParams: makeSearchParams({ modo: "individual" }) }));

    expect(screen.getByText("Passo 2 de 2")).toBeInTheDocument();
    expect(screen.getByText(/Cadastro do FitOS Livre/)).toBeInTheDocument();
  });
});
