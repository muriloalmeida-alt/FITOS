import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

function requestFor(path: string, cookie?: string) {
  const headers = cookie ? { cookie } : undefined;
  return new NextRequest(new URL(path, "http://localhost:3000"), { headers });
}

describe("proxy (proteção otimista de rota)", () => {
  it("redireciona para /entrar quando não há cookie de sessão em rota protegida", () => {
    const response = proxy(requestFor("/painel"));

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/entrar");
    expect(location.searchParams.get("redirecionar")).toBe("/painel");
  });

  it("permite acesso a /painel quando há cookie de sessão", () => {
    const response = proxy(requestFor("/painel", "better-auth.session_token=algum-token"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("redireciona para /painel quando usuário com sessão acessa /entrar", () => {
    const response = proxy(requestFor("/entrar", "better-auth.session_token=algum-token"));

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/painel");
  });

  it("permite acesso a /entrar quando não há sessão", () => {
    const response = proxy(requestFor("/entrar"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });
});
