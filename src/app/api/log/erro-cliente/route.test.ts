// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

afterEach(() => vi.restoreAllMocks());

describe("POST /api/log/erro-cliente", () => {
  it("grava uma linha JSON com a página, a mensagem e o digest", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await POST(new Request("http://x/api/log/erro-cliente", { method: "POST", body: JSON.stringify({ boundary: "app", page: "/painel", message: "boom", digest: "123", password: "nunca" }) }));
    expect(response.status).toBe(204);
    const entry = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(entry).toMatchObject({ level: "error", event: "client_error", boundary: "app", page: "/painel", message: "boom", digest: "123" });
    expect(entry.password).toBeUndefined();
  });

  it("recusa corpo inválido ou grande demais", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect((await POST(new Request("http://x", { method: "POST", body: "não é json" }))).status).toBe(400);
    expect((await POST(new Request("http://x", { method: "POST", body: "x".repeat(20_001) }))).status).toBe(413);
  });
});
