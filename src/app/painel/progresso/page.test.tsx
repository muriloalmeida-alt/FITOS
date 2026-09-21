import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const requireStudent = vi.fn();
const listAssessmentsForStudent = vi.fn();
const redirect = vi.fn((_url: string) => {
  throw new Error("NEXT_REDIRECT");
});

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
    "@/modules/tenancy/authContext"
  );
  return { ...actual, requireStudent: (...args: unknown[]) => requireStudent(...args) };
});

vi.mock("@/modules/evolution/assessments", async () => {
  const actual = await vi.importActual<typeof import("@/modules/evolution/assessments")>(
    "@/modules/evolution/assessments"
  );
  return { ...actual, listAssessmentsForStudent: (...args: unknown[]) => listAssessmentsForStudent(...args) };
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirect(url),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/modules/identity/auth-client", () => ({
  signOut: vi.fn(),
}));

describe("ProgressoPage (FIT-042)", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("redireciona para /entrar quando não há sessão", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
      "@/modules/tenancy/authContext"
    );
    requireStudent.mockRejectedValue(new AuthError("UNAUTHENTICATED", "Sessão ausente ou inválida."));
    const { default: ProgressoPage } = await import("./page");

    await expect(ProgressoPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/entrar");
  });

  it("redireciona para /painel quando o usuário não é aluno com vínculo ativo", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>(
      "@/modules/tenancy/authContext"
    );
    requireStudent.mockRejectedValue(new AuthError("FORBIDDEN", "Acesso restrito a aluno com vínculo ativo."));
    const { default: ProgressoPage } = await import("./page");

    await expect(ProgressoPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/painel");
  });

  it("estado vazio honesto quando não há nenhuma avaliação", async () => {
    requireStudent.mockResolvedValue({ userId: "u1", role: "ALUNO", tenantId: "t1", studentId: "s1" });
    listAssessmentsForStudent.mockResolvedValue([]);
    const { default: ProgressoPage } = await import("./page");

    render(await ProgressoPage());

    expect(screen.getByText("Nenhuma avaliação registrada ainda. Fale com seu personal.")).toBeInTheDocument();
  });

  it("mostra a tabela com peso, gordura, medidas e observação, sempre presente mesmo com uma única avaliação", async () => {
    requireStudent.mockResolvedValue({ userId: "u1", role: "ALUNO", tenantId: "t1", studentId: "s1" });
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
    const { default: ProgressoPage } = await import("./page");

    render(await ProgressoPage());

    expect(screen.getByRole("columnheader", { name: "Peso" })).toBeInTheDocument();
    expect(screen.getByText("82.5kg")).toBeInTheDocument();
    expect(screen.getByText("18.5%")).toBeInTheDocument();
    expect(screen.getByText("Cintura: 85.5cm")).toBeInTheDocument();
    expect(screen.getByText("Evolução consistente")).toBeInTheDocument();
    // Só uma avaliação com peso — gráfico exige ao menos 2 pontos.
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("mostra o gráfico de evolução (equivalente ao texto/tabela) quando há duas ou mais avaliações com peso", async () => {
    requireStudent.mockResolvedValue({ userId: "u1", role: "ALUNO", tenantId: "t1", studentId: "s1" });
    listAssessmentsForStudent.mockResolvedValue([
      { id: "a2", recordedAt: new Date("2026-09-15T00:00:00.000Z"), weightGrams: 80000, bodyFatTenthPercent: null, notes: null, measurements: [] },
      { id: "a1", recordedAt: new Date("2026-09-01T00:00:00.000Z"), weightGrams: 82500, bodyFatTenthPercent: null, notes: null, measurements: [] },
    ]);
    const { default: ProgressoPage } = await import("./page");

    render(await ProgressoPage());

    const chart = screen.getByRole("img");
    expect(chart).toHaveAccessibleName(/82.5kg.*80kg/);
    expect(screen.getByText("82.5kg")).toBeInTheDocument();
    expect(screen.getByText("80kg")).toBeInTheDocument();
  });
});
