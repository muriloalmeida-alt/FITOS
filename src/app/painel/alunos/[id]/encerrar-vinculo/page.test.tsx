import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const requirePersonal = vi.fn();
const getStudentForTenant = vi.fn();
const redirect = vi.fn((_url: string) => {
  throw new Error("NEXT_REDIRECT");
});
const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
  return { ...actual, requirePersonal: (...args: unknown[]) => requirePersonal(...args) };
});

vi.mock("@/modules/students/students", async () => {
  const actual = await vi.importActual<typeof import("@/modules/students/students")>("@/modules/students/students");
  return { ...actual, getStudentForTenant: (...args: unknown[]) => getStudentForTenant(...args) };
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

describe("EncerrarVinculoPage (FIT-106)", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("redireciona para /painel quando o usuário autenticado não é personal", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
    requirePersonal.mockRejectedValue(new AuthError("FORBIDDEN", "Acesso restrito a personal."));
    const { default: EncerrarVinculoPage } = await import("./page");

    await expect(EncerrarVinculoPage({ params: makeParams("s1") })).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/painel");
  });

  it("chama notFound quando o aluno não pertence ao tenant da sessão", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    getStudentForTenant.mockResolvedValue(null);
    const { default: EncerrarVinculoPage } = await import("./page");

    await expect(EncerrarVinculoPage({ params: makeParams("s1") })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("redireciona para o perfil quando o vínculo já está encerrado (nunca reabre pela UI)", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    getStudentForTenant.mockResolvedValue({ id: "s1", displayName: "Fulano", status: "VINCULO_ENCERRADO" });
    const { default: EncerrarVinculoPage } = await import("./page");

    await expect(EncerrarVinculoPage({ params: makeParams("s1") })).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/painel/alunos/s1");
  });

  it("mostra a confirmação explícita com nome do aluno e explica que é definitivo", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    getStudentForTenant.mockResolvedValue({ id: "s1", displayName: "Fulano", email: "fulano@example.test", status: "ATIVO" });
    const { default: EncerrarVinculoPage } = await import("./page");

    render(await EncerrarVinculoPage({ params: makeParams("s1") }));

    expect(screen.getByText("Encerrar vínculo com Fulano?")).toBeInTheDocument();
    expect(screen.getByText(/definitiva/)).toBeInTheDocument();
    expect(screen.getByText(/nunca pode ser reaberto/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar encerramento" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cancelar" })).toHaveAttribute("href", "/painel/alunos/s1");
  });
});
