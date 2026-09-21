import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const requirePersonal = vi.fn();
const getStudentForTenant = vi.fn();
const getLatestInvitationForStudent = vi.fn();
const getActivePlanAssignmentForStudent = vi.fn();
const listEndedPlanAssignmentsForStudent = vi.fn();
const listTrainingPlansForTenant = vi.fn();
const listAssessmentsForStudent = vi.fn();
const redirect = vi.fn((_url: string) => {
  throw new Error("NEXT_REDIRECT");
});
const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
    "@/modules/tenancy/authContext"
  );
  return { ...actual, requirePersonal: (...args: unknown[]) => requirePersonal(...args) };
});

vi.mock("@/modules/students/students", async () => {
  const actual = await vi.importActual<typeof import("@/modules/students/students")>("@/modules/students/students");
  return { ...actual, getStudentForTenant: (...args: unknown[]) => getStudentForTenant(...args) };
});

vi.mock("@/modules/students/invitations", async () => {
  const actual = await vi.importActual<typeof import("@/modules/students/invitations")>(
    "@/modules/students/invitations"
  );
  return { ...actual, getLatestInvitationForStudent: (...args: unknown[]) => getLatestInvitationForStudent(...args) };
});

vi.mock("@/modules/workouts/workouts", async () => {
  const actual = await vi.importActual<typeof import("@/modules/workouts/workouts")>("@/modules/workouts/workouts");
  return {
    ...actual,
    getActivePlanAssignmentForStudent: (...args: unknown[]) => getActivePlanAssignmentForStudent(...args),
    listEndedPlanAssignmentsForStudent: (...args: unknown[]) => listEndedPlanAssignmentsForStudent(...args),
    listTrainingPlansForTenant: (...args: unknown[]) => listTrainingPlansForTenant(...args),
  };
});

vi.mock("@/modules/evolution/assessments", async () => {
  const actual = await vi.importActual<typeof import("@/modules/evolution/assessments")>(
    "@/modules/evolution/assessments"
  );
  return { ...actual, listAssessmentsForStudent: (...args: unknown[]) => listAssessmentsForStudent(...args) };
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirect(url),
  notFound: () => notFound(),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/modules/identity/auth-client", () => ({
  signOut: vi.fn(),
}));

function makeParams(id: string) {
  return Promise.resolve({ id });
}

describe("AlunoPerfilPage (FIT-014)", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("redireciona para /entrar quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
      "@/modules/tenancy/authContext"
    );
    requirePersonal.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));
    const { default: AlunoPerfilPage } = await import("./page");

    await expect(AlunoPerfilPage({ params: makeParams("s1") })).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/entrar");
  });

  it("chama notFound quando o aluno não pertence ao tenant da sessão", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    getStudentForTenant.mockResolvedValue(null);
    const { default: AlunoPerfilPage } = await import("./page");

    await expect(AlunoPerfilPage({ params: makeParams("s1") })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(getStudentForTenant).toHaveBeenCalledWith({ tenantId: "tenant-real", studentId: "s1" });
  });

  it("mostra o link de inativar para aluno ativo, com e-mail editável (sem userId)", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    getStudentForTenant.mockResolvedValue({
      id: "s1",
      displayName: "Fulano",
      email: "fulano@example.test",
      status: "ATIVO",
      userId: null,
    });
    getLatestInvitationForStudent.mockResolvedValue(null);
    getActivePlanAssignmentForStudent.mockResolvedValue(null);
    listEndedPlanAssignmentsForStudent.mockResolvedValue([]);
    listTrainingPlansForTenant.mockResolvedValue([]);
    listAssessmentsForStudent.mockResolvedValue([]);
    const { default: AlunoPerfilPage } = await import("./page");

    render(await AlunoPerfilPage({ params: makeParams("s1") }));

    expect(screen.getByRole("link", { name: "Inativar aluno" })).toBeInTheDocument();
    expect(screen.getByLabelText("E-mail")).not.toBeDisabled();
    expect(screen.getByText("Não convidado")).toBeInTheDocument();
  });

  it("mostra o botão de reativar para aluno inativo, com e-mail bloqueado (userId presente)", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    getStudentForTenant.mockResolvedValue({
      id: "s1",
      displayName: "Fulano",
      email: "fulano@example.test",
      status: "INATIVO",
      userId: "user-1",
    });
    getLatestInvitationForStudent.mockResolvedValue(null);
    getActivePlanAssignmentForStudent.mockResolvedValue(null);
    listEndedPlanAssignmentsForStudent.mockResolvedValue([]);
    listTrainingPlansForTenant.mockResolvedValue([]);
    listAssessmentsForStudent.mockResolvedValue([]);
    const { default: AlunoPerfilPage } = await import("./page");

    render(await AlunoPerfilPage({ params: makeParams("s1") }));

    expect(screen.getByRole("button", { name: "Reativar aluno" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Inativar aluno" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("E-mail")).toBeDisabled();
    expect(screen.queryByText("Acesso e convite")).not.toBeInTheDocument();
  });

  it("mostra a seção de convite apenas para aluno ativo, com o status derivado correto", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    getStudentForTenant.mockResolvedValue({
      id: "s1",
      displayName: "Fulano",
      email: "fulano@example.test",
      status: "ATIVO",
      userId: null,
    });
    getLatestInvitationForStudent.mockResolvedValue({
      id: "inv1",
      status: "PENDENTE",
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    });
    getActivePlanAssignmentForStudent.mockResolvedValue(null);
    listEndedPlanAssignmentsForStudent.mockResolvedValue([]);
    listTrainingPlansForTenant.mockResolvedValue([]);
    listAssessmentsForStudent.mockResolvedValue([]);
    const { default: AlunoPerfilPage } = await import("./page");

    render(await AlunoPerfilPage({ params: makeParams("s1") }));

    expect(screen.getByText("Convite pendente")).toBeInTheDocument();
  });

  it("mostra o programa ativo com data de atribuição e a opção de encerrar (FIT-033)", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    getStudentForTenant.mockResolvedValue({
      id: "s1",
      displayName: "Fulano",
      email: "fulano@example.test",
      status: "ATIVO",
      userId: null,
    });
    getLatestInvitationForStudent.mockResolvedValue(null);
    getActivePlanAssignmentForStudent.mockResolvedValue({
      id: "a1",
      assignedAt: new Date("2026-09-01T00:00:00.000Z"),
      trainingPlan: { name: "Programa A" },
    });
    listEndedPlanAssignmentsForStudent.mockResolvedValue([]);
    listTrainingPlansForTenant.mockResolvedValue([{ id: "p1", name: "Programa A" }]);
    listAssessmentsForStudent.mockResolvedValue([]);
    const { default: AlunoPerfilPage } = await import("./page");

    render(await AlunoPerfilPage({ params: makeParams("s1") }));

    expect(screen.getAllByText("Programa A").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Encerrar atribuição" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Trocar programa" })).toBeInTheDocument();
  });

  it("mostra o estado sem programa quando não há atribuição ativa nem histórico", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    getStudentForTenant.mockResolvedValue({
      id: "s1",
      displayName: "Fulano",
      email: "fulano@example.test",
      status: "ATIVO",
      userId: null,
    });
    getLatestInvitationForStudent.mockResolvedValue(null);
    getActivePlanAssignmentForStudent.mockResolvedValue(null);
    listEndedPlanAssignmentsForStudent.mockResolvedValue([]);
    listTrainingPlansForTenant.mockResolvedValue([]);
    listAssessmentsForStudent.mockResolvedValue([]);
    const { default: AlunoPerfilPage } = await import("./page");

    render(await AlunoPerfilPage({ params: makeParams("s1") }));

    expect(screen.getByText("Nenhum programa atribuído ainda.")).toBeInTheDocument();
  });

  it("mostra o estado de programa encerrado quando há histórico mas nenhuma atribuição ativa", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    getStudentForTenant.mockResolvedValue({
      id: "s1",
      displayName: "Fulano",
      email: "fulano@example.test",
      status: "ATIVO",
      userId: null,
    });
    getLatestInvitationForStudent.mockResolvedValue(null);
    getActivePlanAssignmentForStudent.mockResolvedValue(null);
    listEndedPlanAssignmentsForStudent.mockResolvedValue([
      { id: "a0", active: false, trainingPlan: { name: "Programa Antigo" } },
    ]);
    listTrainingPlansForTenant.mockResolvedValue([]);
    listAssessmentsForStudent.mockResolvedValue([]);
    const { default: AlunoPerfilPage } = await import("./page");

    render(await AlunoPerfilPage({ params: makeParams("s1") }));

    expect(screen.getByText("Nenhum programa ativo atualmente.")).toBeInTheDocument();
  });

  it("mostra o estado vazio de avaliações quando não há nenhuma registrada (FIT-042)", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    getStudentForTenant.mockResolvedValue({
      id: "s1",
      displayName: "Fulano",
      email: "fulano@example.test",
      status: "ATIVO",
      userId: null,
    });
    getLatestInvitationForStudent.mockResolvedValue(null);
    getActivePlanAssignmentForStudent.mockResolvedValue(null);
    listEndedPlanAssignmentsForStudent.mockResolvedValue([]);
    listTrainingPlansForTenant.mockResolvedValue([]);
    listAssessmentsForStudent.mockResolvedValue([]);
    const { default: AlunoPerfilPage } = await import("./page");

    render(await AlunoPerfilPage({ params: makeParams("s1") }));

    expect(screen.getByText("Nenhuma avaliação registrada ainda.")).toBeInTheDocument();
  });

  it("mostra o histórico de avaliações convertido para as unidades de exibição (FIT-042)", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    getStudentForTenant.mockResolvedValue({
      id: "s1",
      displayName: "Fulano",
      email: "fulano@example.test",
      status: "ATIVO",
      userId: null,
    });
    getLatestInvitationForStudent.mockResolvedValue(null);
    getActivePlanAssignmentForStudent.mockResolvedValue(null);
    listEndedPlanAssignmentsForStudent.mockResolvedValue([]);
    listTrainingPlansForTenant.mockResolvedValue([]);
    listAssessmentsForStudent.mockResolvedValue([
      {
        id: "a1",
        recordedAt: new Date("2026-09-01T00:00:00.000Z"),
        weightGrams: 82500,
        bodyFatTenthPercent: 185,
        notes: "Evolução consistente",
        measurements: [{ type: "CINTURA", valueMillimeters: 855 }],
      },
    ]);
    const { default: AlunoPerfilPage } = await import("./page");

    render(await AlunoPerfilPage({ params: makeParams("s1") }));

    expect(screen.getByText(/82\.5kg/)).toBeInTheDocument();
    expect(screen.getByText(/18\.5% de gordura/)).toBeInTheDocument();
    expect(screen.getByText(/Cintura: 85\.5cm/)).toBeInTheDocument();
    expect(screen.getByText("Evolução consistente")).toBeInTheDocument();
  });
});
