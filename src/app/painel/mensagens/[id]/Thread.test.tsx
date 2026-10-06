import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Thread } from "./Thread";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh }) }));
const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: "m9" }), { status: 201 }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  refresh.mockReset();
});

const messages = [
  { id: "m1", body: "Senti no ombro.", mine: true, createdAt: "2026-10-05T13:00:00.000Z" },
  { id: "m2", body: "Abra menos os cotovelos.", mine: false, createdAt: "2026-10-06T14:30:00.000Z" },
];

describe("Thread (EPIC-39)", () => {
  it("mostra as mensagens por dia, minhas e do outro lado", () => {
    render(<Thread topicId="t1" resolved={false} backHref="/painel/mensagens" studentHref={null} messages={messages} />);
    expect(screen.getByText("Senti no ombro.").className).toContain("mine");
    expect(screen.getByText("Abra menos os cotovelos.").className).toContain("theirs");
    expect(screen.getByText(/seg\.?, 5 de out/i)).toBeInTheDocument();
    expect(screen.getByText(/ter\.?, 6 de out/i)).toBeInTheDocument();
  });

  it("envia a resposta e atualiza", async () => {
    render(<Thread topicId="t1" resolved={false} backHref="/painel/mensagens" studentHref={null} messages={messages} />);
    const send = screen.getByRole("button", { name: "Enviar" });
    expect(send).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Mensagem"), "Combinado!");
    await userEvent.click(send);
    expect(fetchMock).toHaveBeenCalledWith("/api/mensagens/t1", expect.objectContaining({ method: "POST", body: JSON.stringify({ body: "Combinado!" }) }));
    expect(refresh).toHaveBeenCalled();
    expect(screen.getByLabelText("Mensagem")).toHaveValue("");
  });

  it("resolvido: avisa e oferece reabrir", async () => {
    render(<Thread topicId="t1" resolved backHref="/painel/mensagens?aluno=s1" studentHref="/painel/alunos/s1" messages={messages} />);
    expect(screen.getByText("Assunto resolvido. Uma nova mensagem reabre.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver aluno" })).toHaveAttribute("href", "/painel/alunos/s1");
    await userEvent.click(screen.getByRole("button", { name: "Reabrir" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/mensagens/t1", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ resolved: false }) }));
  });
});
