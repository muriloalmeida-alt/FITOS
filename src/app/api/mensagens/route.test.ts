import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthError } from "@/modules/tenancy/authContext";
import { ChatError } from "@/modules/messages/messages";

const requireChatViewer = vi.fn();
const createTopic = vi.fn();

vi.mock("@/modules/messages/messages", async () => {
  const actual = await vi.importActual<typeof import("@/modules/messages/messages")>("@/modules/messages/messages");
  return { ...actual, requireChatViewer: (...args: unknown[]) => requireChatViewer(...args), createTopic: (...args: unknown[]) => createTopic(...args) };
});

const post = (body: unknown) => new Request("http://localhost/api/mensagens", { method: "POST", body: JSON.stringify(body) });

describe("POST /api/mensagens (EPIC-39)", () => {
  afterEach(() => vi.resetAllMocks());

  it("abre o assunto com quem está na sessão", async () => {
    const viewer = { role: "ALUNO", userId: "u1", tenantId: "t1", studentId: "s1" };
    requireChatViewer.mockResolvedValue(viewer);
    createTopic.mockResolvedValue({ id: "c1" });
    const { POST } = await import("./route");
    const response = await POST(post({ category: "EXERCICIO", exerciseId: "e1", body: "Dúvida", tenantId: "outro" }));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: "c1" });
    expect(createTopic).toHaveBeenCalledWith(viewer, { category: "EXERCICIO", body: "Dúvida", exerciseId: "e1", exerciseName: null, studentId: null });
  });

  it("400 com erro de validação; 404 sem o aluno; 403 para quem não é aluno nem personal", async () => {
    const { POST } = await import("./route");
    requireChatViewer.mockResolvedValue({ role: "PERSONAL", userId: "u1", tenantId: "t1" });
    createTopic.mockRejectedValueOnce(new ChatError("VALIDACAO", "Escreva a mensagem."));
    expect((await POST(post({ category: "OUTRO", body: "" }))).status).toBe(400);
    createTopic.mockRejectedValueOnce(new ChatError("NAO_ENCONTRADO", "Aluno não encontrado."));
    expect((await POST(post({ category: "OUTRO", body: "oi", studentId: "x" }))).status).toBe(404);
    requireChatViewer.mockRejectedValue(new AuthError("FORBIDDEN", "As mensagens são entre aluno e personal."));
    expect((await POST(post({ category: "OUTRO", body: "oi" }))).status).toBe(403);
  });
});
