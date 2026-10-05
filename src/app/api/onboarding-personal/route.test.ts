import { afterEach, describe, expect, it, vi } from "vitest";

const requirePersonal = vi.fn();
const completePersonalOnboarding = vi.fn();
const getPersonalOnboardingProfile = vi.fn();
const listStudents = vi.fn();
const subscribeTenantToPlan = vi.fn();
const listPlans = vi.fn();
const findTenant = vi.fn();
const findSubscription = vi.fn();

vi.mock("@/modules/billing/plans", () => ({ listActivePlansForAudience: (...args: unknown[]) => listPlans(...args) }));
vi.mock("@/shared/db/prisma", () => ({
  prisma: { tenant: { findUniqueOrThrow: (...args: unknown[]) => findTenant(...args) }, saasSubscription: { findUnique: (...args: unknown[]) => findSubscription(...args) } },
}));

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
  return { ...actual, requirePersonal: (...args: unknown[]) => requirePersonal(...args) };
});

vi.mock("@/modules/personal-onboarding/onboarding", async () => {
  const actual = await vi.importActual<typeof import("@/modules/personal-onboarding/onboarding")>(
    "@/modules/personal-onboarding/onboarding"
  );
  return {
    ...actual,
    completePersonalOnboarding: (...args: unknown[]) => completePersonalOnboarding(...args),
    getPersonalOnboardingProfile: (...args: unknown[]) => getPersonalOnboardingProfile(...args),
  };
});

vi.mock("@/modules/students/students", async () => {
  const actual = await vi.importActual<typeof import("@/modules/students/students")>("@/modules/students/students");
  return { ...actual, listStudents: (...args: unknown[]) => listStudents(...args) };
});

vi.mock("@/modules/billing/subscriptions", async () => {
  const actual = await vi.importActual<typeof import("@/modules/billing/subscriptions")>("@/modules/billing/subscriptions");
  return { ...actual, subscribeTenantToPlan: (...args: unknown[]) => subscribeTenantToPlan(...args) };
});

describe("GET /api/onboarding-personal", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("retorna 401 quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
    requirePersonal.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("retorna completed:false quando o onboarding ainda não foi concluído", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    getPersonalOnboardingProfile.mockResolvedValue(null);

    const { GET } = await import("./route");
    const response = await GET();
    const body = await response.json();

    expect(body).toEqual({ completed: false });
    expect(getPersonalOnboardingProfile).toHaveBeenCalledWith("tenant-real");
  });

  it("retorna completed:true quando o onboarding já foi concluído", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    getPersonalOnboardingProfile.mockResolvedValue({ id: "p1", tenantId: "tenant-real" });

    const { GET } = await import("./route");
    const response = await GET();
    const body = await response.json();

    expect(body).toEqual({ completed: true });
  });
});

describe("POST /api/onboarding-personal (cadastro mínimo, EPIC-33)", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  function post(body: unknown) {
    return new Request("http://x/api/onboarding-personal", { method: "POST", body: JSON.stringify(body) });
  }

  function setup(students = 0, existingPlanId: string | null = null) {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    findTenant.mockResolvedValue({ name: "Studio Murilo" });
    findSubscription.mockResolvedValue(existingPlanId ? { planId: existingPlanId } : null);
    listPlans.mockResolvedValue([
      { id: "p20", studentLimit: 20, priceCents: 4990 },
      { id: "p50", studentLimit: 50, priceCents: 6990 },
      { id: "pinf", studentLimit: null, priceCents: 9990 },
    ]);
    listStudents.mockResolvedValue({ total: students });
    completePersonalOnboarding.mockResolvedValue({});
    subscribeTenantToPlan.mockResolvedValue({});
  }

  it("retorna 401 quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
    requirePersonal.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));
    const { POST } = await import("./route");
    expect((await POST(post({ studentRangeEstimate: "ATE_20" }))).status).toBe(401);
  });

  it("só a faixa de alunos: conclui com o nome do espaço atual, assina o plano sugerido (teste sem cartão) e leva aos primeiros passos", async () => {
    setup();
    const { POST } = await import("./route");
    const response = await POST(post({ studentRangeEstimate: "DE_21_A_50", tenantId: "outro" }));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ redirectTo: "/painel/primeiros-passos" });
    expect(completePersonalOnboarding).toHaveBeenCalledWith({ tenantId: "tenant-real", phone: undefined, cref: undefined, cpfCnpj: undefined, studentRangeEstimate: "DE_21_A_50", businessName: "Studio Murilo", termsAccepted: true });
    expect(subscribeTenantToPlan).toHaveBeenCalledWith({ tenantId: "tenant-real", tenantType: "PERSONAL", planId: "p50", actorUserId: "u1" });
  });

  it("aceita nome do espaço e plano escolhidos; não assina de novo o mesmo plano; com alunos vai ao Início", async () => {
    setup(3, "pinf");
    const { POST } = await import("./route");
    const response = await POST(post({ studentRangeEstimate: "MAIS_DE_50", businessName: "Equipe M", planId: "pinf" }));
    expect(await response.json()).toEqual({ redirectTo: "/painel" });
    expect(completePersonalOnboarding).toHaveBeenCalledWith(expect.objectContaining({ businessName: "Equipe M" }));
    expect(subscribeTenantToPlan).not.toHaveBeenCalled();
  });

  it("400 sem faixa de alunos; erro de domínio vira 400 com o motivo", async () => {
    setup();
    const { POST } = await import("./route");
    expect((await POST(post({}))).status).toBe(400);
    const { OnboardingError } = await vi.importActual<typeof import("@/modules/personal-onboarding/onboarding")>("@/modules/personal-onboarding/onboarding");
    completePersonalOnboarding.mockRejectedValue(new OnboardingError("VALIDACAO", "Informe um celular válido, com DDD."));
    const response = await POST(post({ studentRangeEstimate: "ATE_20", phone: "123" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ message: "Informe um celular válido, com DDD." });
  });

  it("erro de assinatura (ex.: limite abaixo do uso) vira 409, depois de salvar o perfil", async () => {
    setup();
    const { SubscriptionError } = await vi.importActual<typeof import("@/modules/billing/subscriptions")>("@/modules/billing/subscriptions");
    subscribeTenantToPlan.mockRejectedValue(new SubscriptionError("LIMITE_ABAIXO_DO_USO_ATUAL", "Você tem 25 alunos."));
    const { POST } = await import("./route");
    const response = await POST(post({ studentRangeEstimate: "ATE_20" }));
    expect(response.status).toBe(409);
    expect(completePersonalOnboarding).toHaveBeenCalled();
  });
});
