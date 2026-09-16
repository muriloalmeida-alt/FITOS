import { afterEach, describe, expect, it, vi } from "vitest";

const queryRaw = vi.fn();

vi.mock("@/shared/db/prisma", () => ({
  prisma: { $queryRaw: (...args: unknown[]) => queryRaw(...args) },
}));

describe("GET /api/ready", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("retorna 200 e status genérico quando o PostgreSQL responde", async () => {
    queryRaw.mockResolvedValueOnce([{ 1: 1 }]);

    const { GET } = await import("./route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "ready" });
  });

  it("retorna 503 e status genérico quando o PostgreSQL está indisponível, sem expor detalhes internos", async () => {
    queryRaw.mockRejectedValueOnce(
      new Error("connection to server at \"db.internal.railway\" (10.0.0.5), port 5432 failed: password authentication failed for user \"fitos_hml\"")
    );

    const { GET } = await import("./route");
    const response = await GET();
    const body = await response.json();
    const rawBody = JSON.stringify(body);

    expect(response.status).toBe(503);
    expect(body).toEqual({ status: "unavailable" });
    expect(rawBody).not.toMatch(/password|host|port|fitos_hml|db\.internal|stack|Error/i);
  });
});
