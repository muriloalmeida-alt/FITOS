// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireAdmin: vi.fn(), grantAccess: vi.fn(), previewAccessGrant: vi.fn(), revokeAccessGrant: vi.fn(), listAccessGrants: vi.fn() }));

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
  return { ...actual, requireAdmin: mocks.requireAdmin };
});
vi.mock("@/modules/billing/accessGrants", () => mocks);

import { AuthError } from "@/modules/tenancy/authContext";
import { AdminError } from "@/modules/admin/users";
import { GET, POST } from "./route";
import { POST as PREVIEW } from "./previa/route";
import { POST as REVOKE } from "../../../gratuidade/[grantId]/revogar/route";

const params = Promise.resolve({ id: "u1" });
const json = (body: unknown) => new Request("http://x", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({ userId: "admin", role: "ADMIN" });
});

describe("gratuidade pelo administrador (rotas)", () => {
  it("só ADMIN: personal, Livre e aluno recebem 403 e nada é chamado", async () => {
    mocks.requireAdmin.mockRejectedValue(new AuthError("FORBIDDEN", "não"));
    expect((await POST(json({ days: 30 }), { params })).status).toBe(403);
    expect((await PREVIEW(json({ days: 30 }), { params })).status).toBe(403);
    expect((await GET(new Request("http://x"), { params })).status).toBe(403);
    expect((await REVOKE(json({ reason: "x" }), { params: Promise.resolve({ grantId: "g1" }) })).status).toBe(403);
    expect(mocks.grantAccess).not.toHaveBeenCalled();
    expect(mocks.revokeAccessGrant).not.toHaveBeenCalled();
  });

  it("concede com o admin da sessão; repetição devolve 200; prévia velha 409", async () => {
    mocks.grantAccess.mockResolvedValueOnce({ grant: { id: "g1" }, replayed: false }).mockResolvedValueOnce({ grant: { id: "g1" }, replayed: true });
    const body = { days: 30, reasonCode: "SUPORTE", reasonText: "", operationKey: "op-12345678", revision: "r1", adminUserId: "intruso" };
    expect((await POST(json(body), { params })).status).toBe(201);
    expect(mocks.grantAccess).toHaveBeenCalledWith({ adminUserId: "admin", userId: "u1", days: 30, reasonCode: "SUPORTE", reasonText: "", operationKey: "op-12345678", revision: "r1" });
    expect((await POST(json(body), { params })).status).toBe(200);
    mocks.grantAccess.mockRejectedValueOnce(new AdminError("CONFLITO", "mudou"));
    expect((await POST(json(body), { params })).status).toBe(409);
  });

  it("revoga com o motivo enviado", async () => {
    mocks.revokeAccessGrant.mockResolvedValue({ id: "g1", state: "REVOKED" });
    expect((await REVOKE(json({ reason: "engano" }), { params: Promise.resolve({ grantId: "g1" }) })).status).toBe(200);
    expect(mocks.revokeAccessGrant).toHaveBeenCalledWith({ adminUserId: "admin", grantId: "g1", reason: "engano" });
  });
});
