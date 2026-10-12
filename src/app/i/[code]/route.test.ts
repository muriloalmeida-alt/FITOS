import { describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();
vi.mock("@/shared/db/prisma", () => ({ prisma: { tenant: { findUnique: (...args: unknown[]) => findUnique(...args) } } }));
const { GET } = await import("./route");

describe("GET /i/[code] (EPIC-47)", () => {
  it("guarda o código e leva ao cadastro de personal", async () => {
    const response = await GET(new Request("https://app.fitos.test/i/abc23de"), { params: Promise.resolve({ code: "abc23de" }) });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://app.fitos.test/comecar?caminho=personal&indicado=1");
    expect(response.headers.get("set-cookie")).toMatch(/^fitos_indicacao=abc23de; Path=\/; Max-Age=5184000; HttpOnly; SameSite=Lax; Secure$/);
  });

  it("indicação de aluno do FitOS Livre leva ao cadastro do Livre", async () => {
    findUnique.mockResolvedValueOnce({ type: "INDIVIDUAL" });
    const response = await GET(new Request("https://app.fitos.test/i/livre23"), { params: Promise.resolve({ code: "livre23" }) });
    expect(response.headers.get("location")).toBe("https://app.fitos.test/comecar?caminho=livre&indicado=1");
    expect(response.headers.get("set-cookie")).toMatch(/^fitos_indicacao=livre23;/);
  });

  it("código inválido só redireciona", async () => {
    const response = await GET(new Request("https://app.fitos.test/i/x"), { params: Promise.resolve({ code: "../x" }) });
    expect(response.headers.get("location")).toBe("https://app.fitos.test/comecar?caminho=personal");
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
