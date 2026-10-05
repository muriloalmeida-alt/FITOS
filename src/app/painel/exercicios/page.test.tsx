import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "@/shared/ui";

const requireSubscriber = vi.fn();
const listCatalogExercises = vi.fn();
const listCatalogFacets = vi.fn();
const getCatalogExerciseForTenant = vi.fn();
const redirect = vi.fn((_url: string) => {
  throw new Error("NEXT_REDIRECT");
});
const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
const push = vi.fn();

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
  return { ...actual, requireSubscriber: (...args: unknown[]) => requireSubscriber(...args) };
});
vi.mock("@/modules/exercises/exercises", async () => {
  const actual = await vi.importActual<typeof import("@/modules/exercises/exercises")>("@/modules/exercises/exercises");
  return {
    ...actual,
    listCatalogExercises: (...args: unknown[]) => listCatalogExercises(...args),
    listCatalogFacets: (...args: unknown[]) => listCatalogFacets(...args),
    getCatalogExerciseForTenant: (...args: unknown[]) => getCatalogExerciseForTenant(...args),
  };
});
vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirect(url),
  notFound: () => notFound(),
  useRouter: () => ({ push, refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/painel/exercicios",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/modules/identity/auth-client", () => ({ signOut: vi.fn() }));

const facets = { muscles: ["Costas", "Core"], types: ["Pesos livres"], difficulties: ["iniciante"] };
const global = { id: "g1", name: "Remada baixa", origin: "FITOS_CURATED", status: "ATIVO", muscle: "Costas", equipments: "polia", type: "Cabos e polias", difficulty: "iniciante", imageUrl: null, imageAlt: null, instructions: "Sente. Puxe até o abdômen.", safetyInfo: "Coluna neutra." };
const own = { ...global, id: "o1", name: "Meu circuito", origin: "PERSONAL", status: "ARQUIVADO", instructions: null, safetyInfo: null };

describe("Biblioteca de exercícios (FIT-147)", () => {
  afterEach(() => vi.resetAllMocks());

  it("lista com origem, filtros e etiqueta de cada exercício", async () => {
    requireSubscriber.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "t1" });
    listCatalogFacets.mockResolvedValue(facets);
    listCatalogExercises.mockResolvedValue({ items: [global, own], total: 2, page: 1, pageSize: 30 });
    const { default: Page } = await import("./page");
    render(<ToastProvider>{await Page({ searchParams: Promise.resolve({ origem: "meus", musculo: "Costas" }) })}</ToastProvider>);

    expect(listCatalogExercises).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "t1", origin: "meus", muscle: "Costas", pageSize: 30 }));
    expect(screen.getByRole("link", { name: "Meus" })).toHaveAttribute("aria-current", "page");
    const list = screen.getByRole("list", { name: "Lista de exercícios" });
    expect(within(list).getByRole("link", { name: /Remada baixa/ })).toHaveAttribute("href", "/painel/exercicios/g1");
    expect(within(list).getByText("Biblioteca FitOS")).toBeInTheDocument();
    expect(within(list).getByText("Arquivado")).toBeInTheDocument();
    expect(screen.getAllByText("Costas · polia · Iniciante")).toHaveLength(2);
  });

  it("cadastrar abre a sheet com chips e envia o exercício", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "novo" }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    requireSubscriber.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "t1" });
    listCatalogFacets.mockResolvedValue(facets);
    listCatalogExercises.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 30 });
    const { default: Page } = await import("./page");
    render(<ToastProvider>{await Page({ searchParams: Promise.resolve({ novo: "1" }) })}</ToastProvider>);

    const sheet = screen.getByRole("dialog", { name: "Novo exercício" });
    expect(within(sheet).getByRole("button", { name: "Salvar exercício" })).toBeDisabled();
    await user.type(within(sheet).getByLabelText("Nome"), "Agachamento no banco");
    await user.click(within(sheet).getByRole("radio", { name: "Core" }));
    await user.click(within(sheet).getByRole("radio", { name: "peso corporal" }));
    await user.click(within(sheet).getByRole("button", { name: "Salvar exercício" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/exercises", expect.objectContaining({ method: "POST", body: JSON.stringify({ name: "Agachamento no banco", muscle: "Core", equipments: "peso corporal", type: "", instructions: "" }) }));
    expect(push).toHaveBeenCalledWith("/painel/exercicios/novo");
    vi.unstubAllGlobals();
  });

  it("detalhe do global mostra passos, segurança e 'Criar uma versão minha'", async () => {
    requireSubscriber.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "t1" });
    getCatalogExerciseForTenant.mockResolvedValue(global);
    const { default: Detail } = await import("./[id]/page");
    render(<ToastProvider>{await Detail({ params: Promise.resolve({ id: "g1" }) })}</ToastProvider>);
    expect(screen.getByRole("heading", { name: "Remada baixa" })).toBeInTheDocument();
    expect(screen.getByText("Sente.")).toBeInTheDocument();
    expect(screen.getByText("Puxe até o abdômen.")).toBeInTheDocument();
    expect(screen.getByText("Coluna neutra.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Criar uma versão minha" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Usar em um treino" })).toHaveAttribute("href", "/painel/treinos/novo");
  });

  it("detalhe do próprio arquivado oferece Editar e Reativar; outro tenant é 404", async () => {
    requireSubscriber.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "t1" });
    listCatalogFacets.mockResolvedValue(facets);
    getCatalogExerciseForTenant.mockResolvedValueOnce(own);
    const { default: Detail } = await import("./[id]/page");
    render(<ToastProvider>{await Detail({ params: Promise.resolve({ id: "o1" }) })}</ToastProvider>);
    expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reativar" })).toBeInTheDocument();
    getCatalogExerciseForTenant.mockResolvedValueOnce(null);
    await expect(Detail({ params: Promise.resolve({ id: "alheio" }) })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("URL antiga de cadastro abre a sheet na biblioteca", async () => {
    const { default: Novo } = await import("./novo/page");
    expect(() => Novo()).toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/painel/exercicios?origem=meus&novo=1");
  });
});
