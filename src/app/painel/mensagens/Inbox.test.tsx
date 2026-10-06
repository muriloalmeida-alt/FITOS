import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Inbox, relativeTime, type InboxTopic } from "./Inbox";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }), usePathname: () => "/painel/mensagens" }));
const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: "novo" }), { status: 201 }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  push.mockReset();
});

const topic = (over: Partial<InboxTopic> = {}): InboxTopic => ({
  id: "t1",
  category: "EXERCICIO",
  title: "Supino reto",
  studentId: "s1",
  studentName: "Ana Costa",
  studentImage: null,
  lastMessage: "Senti no ombro.",
  lastFromMe: false,
  lastMessageAt: new Date().toISOString(),
  unread: true,
  resolved: false,
  ...over,
});

describe("Inbox (EPIC-39)", () => {
  it("tempo relativo", () => {
    const now = Date.parse("2026-10-06T15:00:00Z");
    expect(relativeTime("2026-10-06T14:59:40Z", now)).toBe("agora");
    expect(relativeTime("2026-10-06T14:20:00Z", now)).toBe("40 min");
    expect(relativeTime("2026-10-06T10:00:00Z", now)).toBe("5 h");
    expect(relativeTime("2026-10-05T12:00:00Z", now)).toBe("ontem");
  });

  it("personal vê o aluno, o assunto e a marca de nova", () => {
    render(<Inbox role="PERSONAL" topics={[topic(), topic({ id: "t2", category: "AGENDA", title: "Agenda", unread: false, resolved: true, lastFromMe: true, lastMessage: "Pode sim." })]} category={null} studentId={null} students={[]} exercises={[]} />);
    expect(screen.getByRole("link", { name: /Ana · Supino reto/ })).toHaveAttribute("href", "/painel/mensagens/t1");
    expect(screen.getByText("Nova")).toBeInTheDocument();
    expect(screen.getByText("Resolvido")).toBeInTheDocument();
    expect(screen.getByText("Você: Pode sim.")).toBeInTheDocument();
  });

  it("aluno pergunta sobre um exercício do programa", async () => {
    render(<Inbox role="ALUNO" topics={[]} category={null} studentId={null} students={[]} exercises={[{ id: "e1", name: "Agachamento", workoutName: "Treino A" }]} />);
    await userEvent.click(screen.getByRole("button", { name: "Nova mensagem" }));
    await userEvent.click(screen.getByRole("radio", { name: /Exercício/ }));
    await userEvent.click(screen.getByRole("radio", { name: "Agachamento" }));
    await userEvent.type(screen.getByLabelText("Mensagem"), "Até onde desço?");
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/mensagens", expect.objectContaining({ method: "POST" }));
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({ category: "EXERCICIO", exerciseId: "e1", body: "Até onde desço?" });
    expect(push).toHaveBeenCalledWith("/painel/mensagens/novo");
  });
});
