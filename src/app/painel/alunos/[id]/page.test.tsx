import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const requirePersonal = vi.fn();
const getStudentForTenant = vi.fn();
const getLatestInvitationForStudent = vi.fn();
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
    const { default: AlunoPerfilPage } = await import("./page");

    render(await AlunoPerfilPage({ params: makeParams("s1") }));

    expect(screen.getByText("Convite pendente")).toBeInTheDocument();
  });
});
