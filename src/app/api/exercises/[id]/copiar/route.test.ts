import { afterEach, describe, expect, it, vi } from "vitest";

const requireSubscriber = vi.fn();
const copyCatalogExerciseAsOwn = vi.fn();

vi.mock("@/modules/tenancy/authContext", async () => {
  const actual = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
  return { ...actual, requireSubscriber: (...args: unknown[]) => requireSubscriber(...args) };
});
vi.mock("@/modules/exercises/exercises", async () => {
  const actual = await vi.importActual<typeof import("@/modules/exercises/exercises")>("@/modules/exercises/exercises");
  return { ...actual, copyCatalogExerciseAsOwn: (...args: unknown[]) => copyCatalogExerciseAsOwn(...args) };
});

const params = { params: Promise.resolve({ id: "ex1" }) };
const req = () => new Request("http://localhost/api/exercises/ex1/copiar", { method: "POST" });

describe("POST /api/exercises/[id]/copiar (BK-08)", () => {
  afterEach(() => vi.resetAllMocks());

  it("cria a versão própria no tenant da sessão", async () => {
    requireSubscriber.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "t1" });
    copyCatalogExerciseAsOwn.mockResolvedValue({ id: "own1" });
    const { POST } = await import("./route");
    const response = await POST(req(), params);
    expect(response.status).toBe(201);
    expect(copyCatalogExerciseAsOwn).toHaveBeenCalledWith({ tenantId: "t1", actorUserId: "u1", exerciseId: "ex1" });
  });

  it("403 para aluno e 404 para exercício inexistente", async () => {
    const { AuthError } = await vi.importActual<typeof import("@/modules/tenancy/authContext")>("@/modules/tenancy/authContext");
    requireSubscriber.mockRejectedValueOnce(new AuthError("FORBIDDEN", "x"));
    const { POST } = await import("./route");
    expect((await POST(req(), params)).status).toBe(403);
    const { ExerciseError } = await vi.importActual<typeof import("@/modules/exercises/exercises")>("@/modules/exercises/exercises");
    requireSubscriber.mockResolvedValue({ userId: "u1", role: "PERSONAL", tenantId: "t1" });
    copyCatalogExerciseAsOwn.mockRejectedValue(new ExerciseError("NAO_ENCONTRADO", "Exercício não encontrado."));
    expect((await POST(req(), params)).status).toBe(404);
  });
});
