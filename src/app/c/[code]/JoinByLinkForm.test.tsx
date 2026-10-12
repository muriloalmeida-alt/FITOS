import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JoinByLinkForm } from "./JoinByLinkForm";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
afterEach(() => {
  vi.restoreAllMocks();
  push.mockReset();
});

function api(hero: unknown) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
    if (String(url) === "/api/meu-inicio") return new Response(JSON.stringify({ hero }));
    if (String(url) === "/api/push/chave") return new Response(JSON.stringify({ publicKey: null }));
    return new Response("{}", { status: String(url).startsWith("/api/convite-link") ? 201 : 200 });
  });
}

describe("Entrar pelo convite (EPIC-33, E5)", () => {
  it("conta, objetivo num toque e o treino de hoje para começar agora", async () => {
    const fetchMock = api({ kind: "today", workoutName: "Treino A — Inferiores", exercises: 5, estimatedMinutes: 45 });
    render(<JoinByLinkForm code="abc23456" personalFirstName="Murilo" businessName="Studio Murilo" />);
    await userEvent.click(screen.getByRole("button", { name: "Entrar em Studio Murilo" }));
    expect(screen.getByText("Informe seu nome.")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Seu nome"), "Ana Costa");
    await userEvent.type(screen.getByLabelText("E-mail"), "ana@ex.test");
    await userEvent.type(screen.getByLabelText("Crie uma senha"), "senha-forte-123");
    await userEvent.click(screen.getByRole("button", { name: "Entrar em Studio Murilo" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/convite-link/abc23456", expect.objectContaining({ body: JSON.stringify({ name: "Ana Costa", email: "ana@ex.test", password: "senha-forte-123" }) }));

    expect(await screen.findByRole("heading", { name: "Qual é o seu objetivo?" })).toBeInTheDocument();
    expect(screen.getByText("Murilo vê sua resposta e ajusta o treino.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: /Emagrecer/ }));
    expect(fetchMock).toHaveBeenCalledWith("/api/meu-objetivo", expect.objectContaining({ body: JSON.stringify({ objective: "Emagrecer" }) }));

    // Proposta 11: modalidades para orientar o personal; o programa não muda.
    expect(await screen.findByRole("heading", { name: "Quais modalidades você quer praticar?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled();
    await userEvent.click(screen.getByRole("checkbox", { name: /Funcional/ }));
    await userEvent.click(screen.getByRole("checkbox", { name: /CrossFit/ }));
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/minhas-modalidades", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ modalities: ["funcional", "crossfit"] }) }));

    expect(await screen.findByRole("heading", { name: "Tudo certo, Ana" })).toBeInTheDocument();
    expect(screen.getByText("Preferências salvas. Murilo poderá usá-las no seu programa.")).toBeInTheDocument();
    expect(screen.getByText("Treino A — Inferiores")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Começar agora" })).toHaveAttribute("href", "/painel/treino/sessao");
    expect(JSON.parse(window.localStorage.getItem("fitos:conta")!)).toMatchObject({ name: "Ana Costa", role: "ALUNO" });
  });

  it("sem programa ainda: avisa que o personal vai montar", async () => {
    api({ kind: "noPlan", endedPlanName: null });
    render(<JoinByLinkForm code="abc23456" personalFirstName="Murilo" businessName="Studio Murilo" />);
    await userEvent.type(screen.getByLabelText("Seu nome"), "Ana Costa");
    await userEvent.type(screen.getByLabelText("E-mail"), "ana@ex.test");
    await userEvent.type(screen.getByLabelText("Crie uma senha"), "senha-forte-123");
    await userEvent.click(screen.getByRole("button", { name: "Entrar em Studio Murilo" }));
    await userEvent.click(await screen.findByRole("radio", { name: /Ganhar massa/ }));
    await userEvent.click(await screen.findByRole("checkbox", { name: /Musculação/ }));
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await screen.findByText(/Murilo vai montar seu treino em Studio Murilo/)).toBeInTheDocument();
  });

  it("falha ao salvar as modalidades mantém a seleção e permite tentar de novo", async () => {
    let fail = true;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (String(url) === "/api/minhas-modalidades") return new Response("{}", { status: fail ? 500 : 200 });
      if (String(url) === "/api/meu-inicio") return new Response(JSON.stringify({ hero: { kind: "noPlan" } }));
      return new Response("{}", { status: String(url).startsWith("/api/convite-link") ? 201 : 200 });
    });
    render(<JoinByLinkForm code="abc23456" personalFirstName="Murilo" businessName="Studio Murilo" />);
    await userEvent.type(screen.getByLabelText("Seu nome"), "Ana Costa");
    await userEvent.type(screen.getByLabelText("E-mail"), "ana@ex.test");
    await userEvent.type(screen.getByLabelText("Crie uma senha"), "senha-forte-123");
    await userEvent.click(screen.getByRole("button", { name: "Entrar em Studio Murilo" }));
    await userEvent.click(await screen.findByRole("radio", { name: /Ganhar massa/ }));
    await userEvent.click(await screen.findByRole("checkbox", { name: /Funcional/ }));
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await screen.findByText("Não foi possível salvar suas preferências. Tente de novo.")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Funcional/ })).toHaveAttribute("aria-checked", "true");
    fail = false;
    await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await screen.findByRole("heading", { name: "Tudo certo, Ana" })).toBeInTheDocument();
  });
});
