import { describe, expect, it, vi } from "vitest";

const openInvite = vi.fn();
vi.mock("@/modules/crm/prospects", () => ({ openInvite: (...args: unknown[]) => openInvite(...args) }));
const { GET } = await import("./route");

const behindProxy = (path: string) => new Request(`http://localhost:8080${path}`, { headers: { "x-forwarded-host": "app.fitosx.com.br", "x-forwarded-proto": "https" } });

describe("GET /conheca/[token] (CRM)", () => {
  it("atrás do proxy, leva ao cadastro no endereço público e guarda o convite", async () => {
    openInvite.mockResolvedValueOnce({ token: "tok12345", couponCode: "CONHECA-AAAAAA", name: "Ana" });
    const response = await GET(behindProxy("/conheca/tok12345"), { params: Promise.resolve({ token: "tok12345" }) });
    const location = response.headers.get("location")!;
    expect(location).not.toContain("localhost");
    expect(location).toMatch(/\/comecar\?caminho=livre&convite=1$/);
    expect(response.headers.get("set-cookie")).toContain("tok12345");
  });

  it("convite inválido leva à apresentação, também no endereço público", async () => {
    openInvite.mockResolvedValueOnce(null);
    const response = await GET(behindProxy("/conheca/xx"), { params: Promise.resolve({ token: "xx" }) });
    expect(response.headers.get("location")).not.toContain("localhost");
    expect(response.headers.get("location")).toMatch(/\/conheca$/);
  });
});
