import { afterEach, describe, expect, it, vi } from "vitest";

const requireIndividual = vi.fn();
const completeIndividualOnboarding = vi.fn();
const getIndividualOnboardingProfile = vi.fn();

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
    "@/modules/tenancy/authContext"
  );
  return {
    ...actual,
    requireIndividual: (...args: unknown[]) => requireIndividual(...args),
  };
});

vi.mock("@/modules/individual-onboarding/onboarding", async () => {
  const actual = await vi.importActual<typeof import("@/modules/individual-onboarding/onboarding")>(
    "@/modules/individual-onboarding/onboarding"
  );
  return {
    ...actual,
    completeIndividualOnboarding: (...args: unknown[]) => completeIndividualOnboarding(...args),
    getIndividualOnboardingProfile: (...args: unknown[]) => getIndividualOnboardingProfile(...args),
  };
});

describe("GET /api/onboarding", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("retorna 401 quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
      "@/modules/tenancy/authContext"
    );
    requireIndividual.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("retorna 403 quando o usuário autenticado não é individual", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
      "@/modules/tenancy/authContext"
    );
    requireIndividual.mockRejectedValue(new AuthError("FORBIDDEN", "Acesso restrito ao workspace individual (FitOS Livre)."));

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(403);
  });

  it("retorna completed:false quando o onboarding ainda não foi concluído", async () => {
    requireIndividual.mockResolvedValue({ userId: "u1", role: "INDIVIDUAL", tenantId: "tenant-real" });
    getIndividualOnboardingProfile.mockResolvedValue(null);

    const { GET } = await import("./route");
    const response = await GET();
    const body = await response.json();

    expect(body).toEqual({ completed: false });
    expect(getIndividualOnboardingProfile).toHaveBeenCalledWith("tenant-real");
  });

  it("retorna completed:true quando o onboarding já foi concluído", async () => {
    requireIndividual.mockResolvedValue({ userId: "u1", role: "INDIVIDUAL", tenantId: "tenant-real" });
    getIndividualOnboardingProfile.mockResolvedValue({ id: "p1", tenantId: "tenant-real" });

    const { GET } = await import("./route");
    const response = await GET();
    const body = await response.json();

    expect(body).toEqual({ completed: true });
  });
});

describe("POST /api/onboarding", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("retorna 401 quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
      "@/modules/tenancy/authContext"
    );
    requireIndividual.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/onboarding", { method: "POST", body: "{}" }));

    expect(response.status).toBe(401);
  });

  it("conclui o onboarding usando o tenantId da sessão, ignorando qualquer tenantId enviado no corpo", async () => {
    requireIndividual.mockResolvedValue({ userId: "u1", role: "INDIVIDUAL", tenantId: "tenant-real" });
    completeIndividualOnboarding.mockResolvedValue({
      id: "p1",
      tenantId: "tenant-real",
      objective: "GANHAR_MASSA",
      experienceLevel: "INICIANTE",
      weeklyAvailability: "TRES_A_QUATRO_DIAS",
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/onboarding", {
        method: "POST",
        body: JSON.stringify({
          objective: "GANHAR_MASSA",
          experienceLevel: "INICIANTE",
          weeklyAvailability: "TRES_A_QUATRO_DIAS",
          tenantId: "tenant-adulterado",
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.tenantId).toBe("tenant-real");
    expect(completeIndividualOnboarding).toHaveBeenCalledWith({
      tenantId: "tenant-real",
      objective: "GANHAR_MASSA",
      experienceLevel: "INICIANTE",
      weeklyAvailability: "TRES_A_QUATRO_DIAS",
    });
  });

  it("retorna 400 quando faltam ou são inválidos os campos obrigatórios", async () => {
    requireIndividual.mockResolvedValue({ userId: "u1", role: "INDIVIDUAL", tenantId: "tenant-real" });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/onboarding", { method: "POST", body: JSON.stringify({ objective: "NAO_EXISTE" }) })
    );

    expect(response.status).toBe(400);
    expect(completeIndividualOnboarding).not.toHaveBeenCalled();
  });

  it("retorna 400 com o motivo quando o domínio rejeita", async () => {
    const { OnboardingError } = await vi.importActual<typeof import("@/modules/individual-onboarding/onboarding")>(
      "@/modules/individual-onboarding/onboarding"
    );
    requireIndividual.mockResolvedValue({ userId: "u1", role: "INDIVIDUAL", tenantId: "tenant-real" });
    completeIndividualOnboarding.mockRejectedValue(new OnboardingError("VALIDACAO", "Objetivo inválido."));

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/onboarding", {
        method: "POST",
        body: JSON.stringify({ objective: "GANHAR_MASSA", experienceLevel: "INICIANTE", weeklyAvailability: "UM_A_DOIS_DIAS" }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("VALIDACAO");
  });
});
