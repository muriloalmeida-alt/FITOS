import { afterEach, describe, expect, it, vi } from "vitest";

const requirePersonal = vi.fn();
const completePersonalOnboarding = vi.fn();
const getPersonalOnboardingProfile = vi.fn();
const listStudents = vi.fn();

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

describe("POST /api/onboarding-personal", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("retorna 401 quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
    requirePersonal.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));

    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/onboarding-personal", { method: "POST", body: "{}" }));

    expect(response.status).toBe(401);
  });

  it("conclui usando o tenantId da sessão, ignorando tenantId do corpo; redireciona para cadastrar o primeiro aluno quando o tenant não tem nenhum", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    completePersonalOnboarding.mockResolvedValue({ id: "p1", tenantId: "tenant-real" });
    listStudents.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 1 });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/onboarding-personal", {
        method: "POST",
        body: JSON.stringify({
          phone: "(11) 91234-5678",
          studentRangeEstimate: "COMECANDO_AGORA",
          businessName: "Meu Espaço",
          termsAccepted: true,
          tenantId: "tenant-adulterado",
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual({ redirectTo: "/painel/alunos/novo" });
    expect(completePersonalOnboarding).toHaveBeenCalledWith({
      tenantId: "tenant-real",
      phone: "(11) 91234-5678",
      cref: undefined,
      studentRangeEstimate: "COMECANDO_AGORA",
      businessName: "Meu Espaço",
      termsAccepted: true,
    });
  });

  it("redireciona para /painel quando o tenant já tem pelo menos um aluno", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    completePersonalOnboarding.mockResolvedValue({ id: "p1", tenantId: "tenant-real" });
    listStudents.mockResolvedValue({ items: [], total: 3, page: 1, pageSize: 1 });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/onboarding-personal", {
        method: "POST",
        body: JSON.stringify({
          phone: "(11) 91234-5678",
          studentRangeEstimate: "MAIS_DE_50",
          businessName: "Meu Espaço",
          termsAccepted: true,
        }),
      })
    );
    const body = await response.json();

    expect(body).toEqual({ redirectTo: "/painel" });
  });

  it("retorna 400 quando faltam ou são inválidos os campos obrigatórios", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/onboarding-personal", { method: "POST", body: JSON.stringify({ phone: "(11) 91234-5678" }) })
    );

    expect(response.status).toBe(400);
    expect(completePersonalOnboarding).not.toHaveBeenCalled();
  });

  it("retorna 400 com o motivo quando o domínio rejeita", async () => {
    const { OnboardingError } = await vi.importActual<typeof import("@/modules/personal-onboarding/onboarding")>(
      "@/modules/personal-onboarding/onboarding"
    );
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    completePersonalOnboarding.mockRejectedValue(new OnboardingError("VALIDACAO", "Informe um celular válido, com DDD."));

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/onboarding-personal", {
        method: "POST",
        body: JSON.stringify({ phone: "123", studentRangeEstimate: "ATE_20", businessName: "Nome", termsAccepted: true }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("VALIDACAO");
  });
});
