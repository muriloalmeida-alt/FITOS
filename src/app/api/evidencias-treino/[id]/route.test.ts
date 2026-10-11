// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireSelfStudent: vi.fn(), resolvePhotoViewer: vi.fn(), getEvidenceForViewer: vi.fn(), deleteSessionEvidence: vi.fn(), addSessionEvidence: vi.fn(), listSessionEvidence: vi.fn() }));

vi.mock("@/modules/tenancy/selfStudent", () => ({ requireSelfStudent: mocks.requireSelfStudent }));
vi.mock("@/modules/media/photoAccess", async () => {
  const actual = await vi.importActual<typeof import("@/modules/media/photoAccess")>("@/modules/media/photoAccess");
  return { ...actual, resolvePhotoViewer: mocks.resolvePhotoViewer };
});
vi.mock("@/modules/execution/evidence", () => ({
  getEvidenceForViewer: mocks.getEvidenceForViewer,
  deleteSessionEvidence: mocks.deleteSessionEvidence,
  addSessionEvidence: mocks.addSessionEvidence,
  listSessionEvidence: mocks.listSessionEvidence,
}));

import { AuthError } from "@/modules/tenancy/authContext";
import { DELETE, GET } from "./route";
import { POST } from "../../minhas-sessoes/[id]/evidencias/route";

const params = Promise.resolve({ id: "e1" });
const self = { userId: "u1", role: "INDIVIDUAL", tenantId: "t1", studentId: "s1" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireSelfStudent.mockResolvedValue(self);
});

describe("evidência do treino (rotas)", () => {
  it("imagem privada, sem cache compartilhado; 404 fora do escopo", async () => {
    mocks.resolvePhotoViewer.mockResolvedValue({ role: "PERSONAL", tenantId: "t1" });
    mocks.getEvidenceForViewer.mockResolvedValueOnce({ mimeType: "image/jpeg", data: Buffer.from([0xff, 0xd8, 0xff]) });
    const response = await GET(new Request("http://x"), { params });
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=86400");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    mocks.getEvidenceForViewer.mockResolvedValueOnce(null);
    expect((await GET(new Request("http://x"), { params })).status).toBe(404);
  });

  it("envio e exclusão só por quem treinou: personal recebe 403", async () => {
    const form = new FormData();
    form.set("foto", new Blob([new Uint8Array([0xff, 0xd8, 0xff])]));
    form.set("largura", "10");
    form.set("altura", "10");
    mocks.addSessionEvidence.mockResolvedValue({ evidence: { id: "e1" }, created: true });
    expect((await POST(new Request("http://x", { method: "POST", body: form }), { params: Promise.resolve({ id: "sess" }) })).status).toBe(201);
    expect(mocks.addSessionEvidence).toHaveBeenCalledWith(expect.objectContaining({ ...self, sessionId: "sess", width: 10, height: 10 }));

    mocks.requireSelfStudent.mockRejectedValue(new AuthError("FORBIDDEN", "Acesso restrito a quem treina."));
    expect((await POST(new Request("http://x", { method: "POST", body: form }), { params: Promise.resolve({ id: "sess" }) })).status).toBe(403);
    expect((await DELETE(new Request("http://x"), { params })).status).toBe(403);
    expect(mocks.deleteSessionEvidence).not.toHaveBeenCalled();
  });
});
