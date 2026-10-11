import { afterEach, describe, expect, it, vi } from "vitest";

const requireAdmin = vi.fn();
const createCoupon = vi.fn();
const featureEnabled = vi.fn();

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
  return { ...actual, requireAdmin: (...args: unknown[]) => requireAdmin(...args) };
});
vi.mock("@/modules/billing/coupons", () => ({ createCoupon: (...args: unknown[]) => createCoupon(...args), listCoupons: vi.fn(async () => []) }));
vi.mock("@/shared/config/features", () => ({ featureEnabled: (...args: unknown[]) => featureEnabled(...args) }));

const post = (body: unknown) => new Request("http://localhost/api/admin/cupons", { method: "POST", body: JSON.stringify(body) });

describe("POST /api/admin/cupons", () => {
  afterEach(() => vi.resetAllMocks());

  it("404 com a flag desligada", async () => {
    featureEnabled.mockReturnValue(false);
    const { POST } = await import("./route");
    expect((await POST(post({}))).status).toBe(404);
    expect(requireAdmin).not.toHaveBeenCalled();
  });

  it("403 para quem não é admin", async () => {
    featureEnabled.mockReturnValue(true);
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
    requireAdmin.mockRejectedValue(new AuthError("FORBIDDEN", "Acesso restrito ao administrador."));
    const { POST } = await import("./route");
    expect((await POST(post({}))).status).toBe(403);
  });

  it("cria com o ator da sessão e só os campos da campanha", async () => {
    featureEnabled.mockReturnValue(true);
    requireAdmin.mockResolvedValue({ userId: "admin-1", role: "ADMIN" });
    createCoupon.mockResolvedValue({ id: "c1" });
    const { POST } = await import("./route");
    const response = await POST(post({ code: "VOLTA20", kind: "PERCENT", amount: 2000, status: "ACTIVE", createdById: "outro", version: 9 }));
    expect(response.status).toBe(201);
    const [actor, input] = createCoupon.mock.calls[0]!;
    expect(actor).toBe("admin-1");
    expect(input).toMatchObject({ code: "VOLTA20", kind: "PERCENT", amount: 2000 });
    expect(input).not.toHaveProperty("status");
    expect(input).not.toHaveProperty("createdById");
  });
});
