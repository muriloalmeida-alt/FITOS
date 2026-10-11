import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const requirePersonal = vi.fn();
const getLibrary = vi.fn();
const listAssignableStudents = vi.fn();
const redirect = vi.fn((_url: string) => {
  throw new Error("NEXT_REDIRECT");
});

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
  return { ...actual, requirePersonal: (...args: unknown[]) => requirePersonal(...args) };
});
vi.mock("@/modules/library/library", () => ({ getLibrary: (...args: unknown[]) => getLibrary(...args) }));
vi.mock("@/modules/workouts/workouts", () => ({ listAssignableStudents: (...args: unknown[]) => listAssignableStudents(...args) }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirect(url),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/painel/treinos",
}));
vi.mock("@/modules/identity/auth-client", () => ({ signOut: vi.fn() }));

const entry = (id: string, name: string, meta: string, cardio = false) => ({ id, name, meta, thumbnails: [], cardio, lines: [{ name: "Agachamento livre", dose: "4 × 10" }] });

async function renderPage(aba?: string) {
  const { default: TreinosPage } = await import("./page");
  render(await TreinosPage({ searchParams: Promise.resolve({ aba }) }));
}

describe("Biblioteca do personal (EPIC-28)", () => {
  afterEach(() => vi.resetAllMocks());

  it("redireciona quem não é personal", async () => {
    const { AuthError } = await import("@/modules/tenancy/authContext");
    requirePersonal.mockRejectedValue(new AuthError("FORBIDDEN", "não"));
    await expect(renderPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/painel");
  });

  it("abas Programas, Treinos e Aeróbicos; aplica a vários alunos e oferece ajustar a cópia", async () => {
    requirePersonal.mockResolvedValue({ userId: "u1", tenantId: "t1" });
    getLibrary.mockResolvedValue({ programs: [entry("p1", "Hipertrofia 8 semanas", "4 treinos · 8 semanas")], workouts: [entry("w1", "Inferiores A", "5 exercícios")], cardio: [entry("c1", "HIIT na bike", "24 min · intervalado", true)] });
    listAssignableStudents.mockResolvedValue([{ id: "s1", displayName: "Pedro Lima" }, { id: "s2", displayName: "Ana Costa" }]);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ applied: 2 }), { status: 201 }));

    await renderPage("aerobicos");
    expect(screen.getByRole("heading", { level: 1, name: "Biblioteca" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Aeróbicos" })).toHaveAttribute("aria-current", "page");
    await userEvent.click(screen.getByRole("button", { name: /HIIT na bike/ }));
    const sheet = screen.getByRole("dialog", { name: "HIIT na bike" });
    await userEvent.click(within(sheet).getByRole("button", { name: "Pedro" }));
    await userEvent.click(within(sheet).getByRole("button", { name: "Ana" }));
    await userEvent.click(within(sheet).getByRole("button", { name: "Aplicar para 2 alunos" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/biblioteca/aplicar", expect.objectContaining({ body: JSON.stringify({ kind: "treino", id: "c1", studentIds: ["s1", "s2"] }) }));
    const done = await screen.findByRole("dialog", { name: "2 cópias criadas" });
    expect(within(done).getByRole("link", { name: "Ajustar a cópia de Pedro" })).toHaveAttribute("href", "/painel/alunos/s1/treino");
    fetchMock.mockRestore();
  });
});
