// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireAdmin: vi.fn(), deleteUserByAdmin: vi.fn(), setUserPasswordByAdmin: vi.fn(), findUnique: vi.fn() }));

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
  return { ...actual, requireAdmin: mocks.requireAdmin };
});
vi.mock("@/modules/admin/users", async () => {
  const actual = await vi.importActual<typeof import("@/modules/admin/users")>("@/modules/admin/users");
  return { ...actual, deleteUserByAdmin: mocks.deleteUserByAdmin, setUserPasswordByAdmin: mocks.setUserPasswordByAdmin };
});
vi.mock("@/shared/db/prisma", () => ({ prisma: { user: { findUnique: mocks.findUnique } } }));
vi.mock("server-only", () => ({}));

import { AuthError } from "@/modules/tenancy/authContext";
import { AdminError } from "@/modules/admin/users";
import { DELETE } from "./route";
import { POST } from "./senha/route";

const params = Promise.resolve({ id: "u1" });
const json = (body: unknown) => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({ userId: "admin", role: "ADMIN" });
  mocks.findUnique.mockResolvedValue({ email: "pedro@ex.test" });
});

describe("DELETE /api/admin/usuarios/[id]", () => {
  it("só exclui com o e-mail confirmado", async () => {
    expect((await DELETE(new Request("http://x", json({ confirmEmail: "outro@ex.test" })), { params })).status).toBe(400);
    expect(mocks.deleteUserByAdmin).not.toHaveBeenCalled();

    mocks.deleteUserByAdmin.mockResolvedValue({ email: "pedro@ex.test" });
    const response = await DELETE(new Request("http://x", json({ confirmEmail: " Pedro@Ex.test " })), { params });
    expect(response.status).toBe(200);
    expect(mocks.deleteUserByAdmin).toHaveBeenCalledWith({ adminUserId: "admin", userId: "u1" });
  });

  it("403 para quem não é admin; 403 para conta protegida; 404 se não existe", async () => {
    mocks.requireAdmin.mockRejectedValueOnce(new AuthError("FORBIDDEN", "não"));
    expect((await DELETE(new Request("http://x", json({ confirmEmail: "pedro@ex.test" })), { params })).status).toBe(403);
    mocks.deleteUserByAdmin.mockRejectedValueOnce(new AdminError("PROIBIDO", "não"));
    expect((await DELETE(new Request("http://x", json({ confirmEmail: "pedro@ex.test" })), { params })).status).toBe(403);
    mocks.findUnique.mockResolvedValueOnce(null);
    expect((await DELETE(new Request("http://x", json({ confirmEmail: "pedro@ex.test" })), { params })).status).toBe(404);
  });
});

describe("POST /api/admin/usuarios/[id]/senha", () => {
  it("troca a senha e devolve 204; validação vira 400", async () => {
    expect((await POST(new Request("http://x", json({ password: "nova-senha-123" })), { params })).status).toBe(204);
    expect(mocks.setUserPasswordByAdmin).toHaveBeenCalledWith({ adminUserId: "admin", userId: "u1", password: "nova-senha-123" });
    mocks.setUserPasswordByAdmin.mockRejectedValueOnce(new AdminError("VALIDACAO", "curta"));
    expect((await POST(new Request("http://x", json({ password: "x" })), { params })).status).toBe(400);
  });
});
