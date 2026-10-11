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
  { id: "m1", body: "Senti no ombro.", mine: true, createdAt: "2026-10-05T13:00:00.000Z", attachment: null },
  { id: "m2", body: "Abra menos os cotovelos.", mine: false, createdAt: "2026-10-06T14:30:00.000Z", attachment: null },
];
const media = (id: string, kind: "VIDEO" | "FOTO", expired = false) => ({ id, kind, durationSec: kind === "VIDEO" ? 12 : null, width: null, height: null, expired });

describe("Thread (EPIC-39)", () => {
  it("mostra as mensagens por dia, minhas e do outro lado", () => {
    render(<Thread topicId="t1" resolved={false} backHref="/painel/mensagens" studentHref={null} messages={messages} />);
    expect(screen.getByText("Senti no ombro.").parentElement!.className).toContain("mine");
    expect(screen.getByText("Abra menos os cotovelos.").parentElement!.className).toContain("theirs");
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

  it("vídeo e foto na conversa; anexo expirado vira aviso", () => {
    const { container } = render(
      <Thread
        topicId="t1"
        resolved={false}
        backHref="/painel/mensagens"
        studentHref={null}
        messages={[
          { id: "m3", body: "", mine: true, createdAt: "2026-10-06T14:31:00.000Z", attachment: media("a1", "VIDEO") },
          { id: "m4", body: "Olha a pegada", mine: true, createdAt: "2026-10-06T14:32:00.000Z", attachment: media("a2", "FOTO") },
          { id: "m5", body: "", mine: true, createdAt: "2026-10-06T14:33:00.000Z", attachment: media("a3", "VIDEO", true) },
        ]}
      />
    );
    expect(container.querySelector("video")).toHaveAttribute("src", "/api/mensagens/anexos/a1");
    expect(screen.getByAltText("Foto enviada na conversa")).toHaveAttribute("src", "/api/mensagens/anexos/a2");
    expect(screen.getByText("Vídeo expirado (mais de 90 dias)")).toBeInTheDocument();
  });

  it("dica de gravar a execução até o primeiro anexo", () => {
    render(<Thread topicId="t1" resolved={false} backHref="/painel/mensagens" studentHref={null} messages={messages} attachHint="Grave a execução" />);
    expect(screen.getByText("Grave a execução")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar vídeo ou foto" })).toBeEnabled();
  });
});

describe("respostas rápidas no Thread (EPIC-41)", () => {
  it("toque coloca no campo; editar salva a lista", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ replies: ["Boa!", "Suba 2 kg"] }), { status: 200 }));
    render(<Thread topicId="t1" resolved={false} backHref="/painel/mensagens" studentHref={null} messages={[]} quickReplies={["Boa!"]} />);
    await userEvent.type(screen.getByLabelText("Mensagem"), "Pedro,");
    await userEvent.click(screen.getByRole("button", { name: "Respostas rápidas" }));
    await userEvent.click(screen.getByRole("button", { name: "Boa!" }));
    expect(screen.getByLabelText("Mensagem")).toHaveValue("Pedro, Boa!");

    await userEvent.click(screen.getByRole("button", { name: "Respostas rápidas" }));
    await userEvent.click(screen.getByRole("button", { name: "Editar" }));
    await userEvent.type(screen.getByLabelText("Resposta 2"), "Suba 2 kg");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/mensagens/respostas-rapidas", expect.objectContaining({ method: "PUT", body: JSON.stringify({ replies: ["Boa!", "Suba 2 kg"] }) }));
    expect(await screen.findByRole("button", { name: "Suba 2 kg" })).toBeInTheDocument();
  });

  it("aluno não tem respostas rápidas", () => {
    render(<Thread topicId="t1" resolved={false} backHref="/painel/mensagens" studentHref={null} messages={[]} />);
    expect(screen.queryByRole("button", { name: "Respostas rápidas" })).toBeNull();
  });
});
