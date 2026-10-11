import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const requireStudent = vi.fn();
const listAssessmentsForStudent = vi.fn();
const listPersonalRecordsForStudent = vi.fn();
const countSessions = vi.fn();
const findStudent = vi.fn();
const redirect = vi.fn((_url: string) => {
  throw new Error("NEXT_REDIRECT");
});

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
  return { ...actual, requireStudent: (...args: unknown[]) => requireStudent(...args) };
});
vi.mock("@/modules/media/photos", () => ({ listEvolutionPhotos: async () => [] }));
vi.mock("@/modules/evolution/assessments", () => ({ listAssessmentsForStudent: (...args: unknown[]) => listAssessmentsForStudent(...args) }));
vi.mock("@/modules/execution/history", () => ({ listPersonalRecordsForStudent: (...args: unknown[]) => listPersonalRecordsForStudent(...args) }));
vi.mock("@/shared/db/prisma", () => ({
  prisma: { workoutSession: { count: (...args: unknown[]) => countSessions(...args) }, student: { findUniqueOrThrow: (...args: unknown[]) => findStudent(...args) }, goal: { findFirst: async () => null } },
}));
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirect(url), useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/modules/identity/auth-client", () => ({ signOut: vi.fn() }));

function asStudent() {
  requireStudent.mockResolvedValue({ userId: "u1", role: "ALUNO", tenantId: "t1", studentId: "s1" });
  findStudent.mockResolvedValue({ id: "s1", tenant: { owner: { name: "Joana Lima" } } });
  countSessions.mockResolvedValue(6);
}

describe("ProgressoPage (FIT-154)", () => {
  afterEach(() => vi.resetAllMocks());

  it("sem sessão vai para /entrar", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
    requireStudent.mockRejectedValue(new AuthError("UNAUTHENTICATED", "x"));
    const { default: ProgressoPage } = await import("./page");
    await expect(ProgressoPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/entrar");
  });

  it("métrica em chips com variação, medidas, treinos do mês e melhores cargas", async () => {
    asStudent();
    listAssessmentsForStudent.mockResolvedValue([
      { id: "a2", recordedAt: new Date("2026-09-20T12:00:00Z"), weightGrams: 72400, bodyFatTenthPercent: 185, notes: null, measurements: [{ type: "CINTURA", valueMillimeters: 820 }] },
      { id: "a1", recordedAt: new Date("2026-07-20T12:00:00Z"), weightGrams: 75000, bodyFatTenthPercent: 210, notes: "Início", measurements: [{ type: "CINTURA", valueMillimeters: 860 }] },
    ]);
    listPersonalRecordsForStudent.mockResolvedValue([{ exerciseName: "Supino reto", loadUsed: "45 kg", loadValue: 45, repsCompleted: 8, achievedAt: new Date("2026-10-01T12:00:00Z") }]);
    const { default: ProgressoPage } = await import("./page");
    render(await ProgressoPage());

    expect(screen.getByRole("tab", { name: "Peso" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText(/−2,6 kg desde/)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Peso: de 75 kg .* para 72,4 kg/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Gordura" }));
    expect(screen.getByText(/−2,5 % desde/)).toBeInTheDocument();
    expect(screen.getByText("−4 cm")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.getByText("45 kg × 8")).toBeInTheDocument();
    expect(screen.getByText("75 kg · 21% gordura · Início")).toBeInTheDocument();
    expect(screen.getAllByText("Ver os dados").length).toBeGreaterThan(0);
  });

  it("sem avaliação diz quem registra, sem gráfico inventado", async () => {
    asStudent();
    listAssessmentsForStudent.mockResolvedValue([]);
    listPersonalRecordsForStudent.mockResolvedValue([]);
    const { default: ProgressoPage } = await import("./page");
    render(await ProgressoPage());
    expect(screen.getByText(/Pese-se ou espere a próxima avaliação com Joana/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pesar hoje" })).toHaveAttribute("href", "/painel/pesar");
    expect(screen.getByRole("link", { name: "Escolher meta" })).toHaveAttribute("href", "/painel/meta");
    expect(screen.queryByRole("img", { name: /Peso/ })).not.toBeInTheDocument();
  });
});
