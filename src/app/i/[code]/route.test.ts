import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /i/[code] (EPIC-47)", () => {
  it("guarda o código e leva ao cadastro de personal", async () => {
    const response = await GET(new Request("https://app.fitos.test/i/abc23de"), { params: Promise.resolve({ code: "abc23de" }) });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://app.fitos.test/comecar?caminho=personal&indicado=1");
    expect(response.headers.get("set-cookie")).toMatch(/^fitos_indicacao=abc23de; Path=\/; Max-Age=5184000; HttpOnly; SameSite=Lax; Secure$/);
  });

  it("código inválido só redireciona", async () => {
    const response = await GET(new Request("https://app.fitos.test/i/x"), { params: Promise.resolve({ code: "../x" }) });
    expect(response.headers.get("location")).toBe("https://app.fitos.test/comecar?caminho=personal");
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
