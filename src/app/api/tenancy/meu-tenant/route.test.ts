import { afterEach, describe, expect, it, vi } from "vitest";

const requirePersonal = vi.fn();
const findUniqueOrThrow = vi.fn();

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
    "@/modules/tenancy/authContext"
  );
  return {
    ...actual,
    requirePersonal: (...args: unknown[]) => requirePersonal(...args),
  };
});

vi.mock("@/shared/db/prisma", () => ({
  prisma: { tenant: { findUniqueOrThrow: (...args: unknown[]) => findUniqueOrThrow(...args) } },
}));

describe("GET /api/tenancy/meu-tenant", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("retorna o tenant da sessão, ignorando um tenantId adulterado na query string", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    findUniqueOrThrow.mockResolvedValue({ id: "tenant-real", name: "Meu tenant real" });

    const { GET } = await import("./route");
    const request = new Request("http://localhost/api/tenancy/meu-tenant?tenantId=tenant-de-outro-personal");
    const response = await GET(request);
    const body = await response.json();

    expect(findUniqueOrThrow).toHaveBeenCalledWith({ where: { id: "tenant-real" } });
    expect(body).toEqual({ id: "tenant-real", name: "Meu tenant real" });
  });

  it("retorna 401 quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
      "@/modules/tenancy/authContext"
    );
    requirePersonal.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/tenancy/meu-tenant"));

    expect(response.status).toBe(401);
  });

  it("retorna 403 quando o usuário autenticado não é personal", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
      "@/modules/tenancy/authContext"
    );
    requirePersonal.mockRejectedValue(new AuthError("FORBIDDEN", "Acesso restrito a personal."));

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/tenancy/meu-tenant"));

    expect(response.status).toBe(403);
  });
});
