import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const requirePersonal = vi.fn();
const listStudents = vi.fn();
const redirect = vi.fn((_url: string) => {
  throw new Error("NEXT_REDIRECT");
});

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
    "@/modules/tenancy/authContext"
  );
  return {
    ...actual,
    requirePersonal: (...args: unknown[]) => requirePersonal(...args),
  };
});

vi.mock("@/modules/students/students", async () => {
  const actual = await vi.importActual<typeof import("@/modules/students/students")>("@/modules/students/students");
  return {
    ...actual,
    listStudents: (...args: unknown[]) => listStudents(...args),
  };
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirect(url),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/modules/identity/auth-client", () => ({
  signOut: vi.fn(),
}));

function makeSearchParams(params: Record<string, string> = {}) {
  return Promise.resolve(params);
}

describe("AlunosPage (FIT-013)", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("redireciona para /entrar quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
      "@/modules/tenancy/authContext"
    );
    requirePersonal.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));
    const { default: AlunosPage } = await import("./page");

    await expect(AlunosPage({ searchParams: makeSearchParams() })).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/entrar");
  });

  it("redireciona para /painel quando o usuário autenticado não é personal", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
      "@/modules/tenancy/authContext"
    );
    requirePersonal.mockRejectedValue(new AuthError("FORBIDDEN", "Acesso restrito a personal."));
    const { default: AlunosPage } = await import("./page");

    await expect(AlunosPage({ searchParams: makeSearchParams() })).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/painel");
  });

  it("mostra o estado vazio quando não há alunos cadastrados", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    listStudents.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
    const { default: AlunosPage } = await import("./page");

    render(await AlunosPage({ searchParams: makeSearchParams() }));

    expect(screen.getByText("Nenhum aluno cadastrado ainda.")).toBeInTheDocument();
  });

  it("mostra o estado vazio de busca sem resultado quando há filtro ativo", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    listStudents.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
    const { default: AlunosPage } = await import("./page");

    render(await AlunosPage({ searchParams: makeSearchParams({ q: "inexistente" }) }));

    expect(screen.getByText("Nenhum resultado para essa busca.")).toBeInTheDocument();
  });

  it("lista os alunos retornados, usando o tenantId da sessão (nunca de query string)", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    listStudents.mockResolvedValue({
      items: [{ id: "s1", displayName: "Fulano", email: "fulano@example.test", status: "ATIVO" }],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    const { default: AlunosPage } = await import("./page");

    render(await AlunosPage({ searchParams: makeSearchParams({ tenantId: "tenant-adulterado" }) }));

    expect(screen.getByText("Fulano")).toBeInTheDocument();
    expect(screen.getByText("fulano@example.test")).toBeInTheDocument();
    expect(listStudents).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "tenant-real" }));
  });

  it("mostra a paginação apenas quando há mais de uma página", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    listStudents.mockResolvedValue({
      items: [{ id: "s1", displayName: "Fulano", email: "fulano@example.test", status: "ATIVO" }],
      total: 25,
      page: 1,
      pageSize: 20,
    });
    const { default: AlunosPage } = await import("./page");

    render(await AlunosPage({ searchParams: makeSearchParams() }));

    expect(screen.getByText("Página 1 de 2")).toBeInTheDocument();
  });
});
