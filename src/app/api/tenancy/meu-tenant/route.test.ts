import { afterEach, describe, expect, it, vi } from "vitest";

const requirePersonal = vi.fn();
const findUniqueOrThrow = vi.fn();
const updatePersonalAccount = vi.fn();

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

vi.mock("@/modules/personal-onboarding/onboarding", async () => {
  const actual = await vi.importActual<typeof import("@/modules/personal-onboarding/onboarding")>("@/modules/personal-onboarding/onboarding");
  return { ...actual, updatePersonalAccount: (...args: unknown[]) => updatePersonalAccount(...args) };
});

describe("PATCH /api/tenancy/meu-tenant (FIT-149)", () => {
  afterEach(() => vi.resetAllMocks());

  it("edita no tenant e no usuário da sessão, ignorando ids do corpo", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    const { PATCH } = await import("./route");
    const response = await PATCH(new Request("http://localhost/api/tenancy/meu-tenant", { method: "PATCH", body: JSON.stringify({ businessName: "Studio", tenantId: "outro", userId: "outro", cref: "" }) }));
    expect(response.status).toBe(204);
    expect(updatePersonalAccount).toHaveBeenCalledWith({ tenantId: "tenant-real", userId: "u1", businessName: "Studio", phone: undefined, cref: "", studentRangeEstimate: undefined, name: undefined });
  });

  it("validação vira 400 com a mensagem", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    const { OnboardingError } = await vi.importActual<typeof import("@/modules/personal-onboarding/onboarding")>("@/modules/personal-onboarding/onboarding");
    updatePersonalAccount.mockRejectedValue(new OnboardingError("VALIDACAO", "Informe um celular válido, com DDD."));
    const { PATCH } = await import("./route");
    const response = await PATCH(new Request("http://localhost/api/tenancy/meu-tenant", { method: "PATCH", body: JSON.stringify({ phone: "1" }) }));
    expect(response.status).toBe(400);
    expect((await response.json()).message).toBe("Informe um celular válido, com DDD.");
  });
});

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
