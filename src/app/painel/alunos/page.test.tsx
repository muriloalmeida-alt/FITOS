import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const requirePersonal = vi.fn();
const listStudents = vi.fn();
const getWeeklyRhythmForStudent = vi.fn();
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

vi.mock("@/modules/workouts/workouts", async () => {
  const actual = await vi.importActual<typeof import("@/modules/workouts/workouts")>("@/modules/workouts/workouts");
  return {
    ...actual,
    getWeeklyRhythmForStudent: (...args: unknown[]) => getWeeklyRhythmForStudent(...args),
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
  beforeEach(() => {
    getWeeklyRhythmForStudent.mockResolvedValue({
      completedDays: 0,
      targetDays: null,
      dayFlags: [false, false, false, false, false, false, false],
    });
  });

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

  it("segmentos Ativos/Inativos/Todos exibem a contagem real de cada um, e o ativo reflete o filtro atual", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    listStudents.mockImplementation(async (input: { status?: string; pageSize?: number }) => {
      if (input.pageSize === 1 && input.status === "ATIVO") return { items: [], total: 24, page: 1, pageSize: 1 };
      if (input.pageSize === 1 && input.status === "INATIVO") return { items: [], total: 5, page: 1, pageSize: 1 };
      if (input.pageSize === 1 && !input.status) return { items: [], total: 29, page: 1, pageSize: 1 };
      return { items: [], total: 24, page: 1, pageSize: 20 };
    });
    const { default: AlunosPage } = await import("./page");

    render(await AlunosPage({ searchParams: makeSearchParams() }));

    const ativosTab = screen.getByRole("tab", { name: "Ativos 24" });
    expect(ativosTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Inativos 5" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tab", { name: "Todos 29" })).toHaveAttribute("aria-selected", "false");
  });

  it("aba 'Todos' exibe um aluno com vínculo encerrado com o rótulo real, nunca um status inventado", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    listStudents.mockImplementation(async (input: { status?: string; pageSize?: number }) => {
      if (input.pageSize === 1) return { items: [], total: 1, page: 1, pageSize: 1 };
      return {
        items: [{ id: "s1", displayName: "Encerrado Antigo", email: "encerrado@example.test", status: "VINCULO_ENCERRADO" }],
        total: 1,
        page: 1,
        pageSize: 20,
      };
    });
    const { default: AlunosPage } = await import("./page");

    render(await AlunosPage({ searchParams: makeSearchParams({ status: "todos" }) }));

    expect(screen.getByText("Encerrado Antigo")).toBeInTheDocument();
    expect(screen.getByText("Vínculo encerrado")).toBeInTheDocument();
  });

  it("FIT-137: mostra o cartão 'Convidar ou cadastrar aluno' e o ritmo semanal real de cada aluno listado", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "tenant-real" });
    listStudents.mockResolvedValue({
      items: [{ id: "s1", displayName: "Fulano", email: "fulano@example.test", status: "ATIVO" }],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    getWeeklyRhythmForStudent.mockResolvedValue({
      completedDays: 2,
      targetDays: 3,
      dayFlags: [true, true, false, false, false, false, false],
    });
    const { default: AlunosPage } = await import("./page");

    render(await AlunosPage({ searchParams: makeSearchParams() }));

    expect(screen.getByRole("link", { name: /Convidar ou cadastrar aluno/ })).toHaveAttribute("href", "/painel/alunos/novo");
    expect(getWeeklyRhythmForStudent).toHaveBeenCalledWith({ tenantId: "tenant-real", studentId: "s1" });
    expect(screen.getByRole("progressbar", { name: "Fulano: 2 de 3 dias treinados nesta semana" })).toBeInTheDocument();
  });
});
