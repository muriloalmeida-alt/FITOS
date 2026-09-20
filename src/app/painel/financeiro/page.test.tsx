import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const requirePersonal = vi.fn();
const listStudents = vi.fn();
const listChargesForTenant = vi.fn();
const redirect = vi.fn((_url: string) => {
  throw new Error("NEXT_REDIRECT");
});

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
    "@/modules/tenancy/authContext"
  );
  return { ...actual, requirePersonal: (...args: unknown[]) => requirePersonal(...args) };
});

vi.mock("@/modules/students/students", async () => {
  const actual = await vi.importActual<typeof import("@/modules/students/students")>(
    "@/modules/students/students"
  );
  return { ...actual, listStudents: (...args: unknown[]) => listStudents(...args) };
});

vi.mock("@/modules/student-finance/charges", async () => {
  const actual = await vi.importActual<typeof import("@/modules/student-finance/charges")>(
    "@/modules/student-finance/charges"
  );
  return { ...actual, listChargesForTenant: (...args: unknown[]) => listChargesForTenant(...args) };
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirect(url),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/modules/identity/auth-client", () => ({
  signOut: vi.fn(),
}));

describe("FinanceiroPage (FIT-050)", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("redireciona para /entrar quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
      "@/modules/tenancy/authContext"
    );
    requirePersonal.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));
    const { default: FinanceiroPage } = await import("./page");

    await expect(FinanceiroPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/entrar");
  });

  it("redireciona para /painel quando o usuário não é personal", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
      "@/modules/tenancy/authContext"
    );
    requirePersonal.mockRejectedValue(new AuthError("FORBIDDEN", "Acesso restrito a personal."));
    const { default: FinanceiroPage } = await import("./page");

    await expect(FinanceiroPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/painel");
  });

  it("estado vazio honesto quando não há nenhuma cobrança", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "t1" });
    listStudents.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 100 });
    listChargesForTenant.mockResolvedValue([]);
    const { default: FinanceiroPage } = await import("./page");

    render(await FinanceiroPage());

    expect(screen.getByText("Nenhuma cobrança cadastrada ainda.")).toBeInTheDocument();
  });

  it("lista cobranças com aluno, descrição, valor e status", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "t1" });
    listStudents.mockResolvedValue({
      items: [{ id: "s1", displayName: "Aluno A" }],
      total: 1,
      page: 1,
      pageSize: 100,
    });
    listChargesForTenant.mockResolvedValue([
      {
        id: "c1",
        description: "Mensalidade outubro",
        amountCents: 15000,
        referenceMonth: new Date("2026-10-01T00:00:00.000Z"),
        dueDate: new Date("2026-10-05T00:00:00.000Z"),
        status: "PENDENTE",
        cancelReason: null,
        student: { id: "s1", displayName: "Aluno A" },
        payment: null,
      },
    ]);
    const { default: FinanceiroPage } = await import("./page");

    render(await FinanceiroPage());

    expect(screen.getAllByText("Aluno A").length).toBeGreaterThan(0);
    expect(screen.getByText(/Mensalidade outubro/)).toBeInTheDocument();
    expect(screen.getByText("R$ 150,00")).toBeInTheDocument();
  });
});
