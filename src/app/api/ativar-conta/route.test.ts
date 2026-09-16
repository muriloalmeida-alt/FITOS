import { afterEach, describe, expect, it, vi } from "vitest";

const activateStudentAccount = vi.fn();

vi.mock("@/modules/identity/activation", async () => {
  const actual = await vi.importActual<typeof import("@/modules/identity/activation")>(
    "@/modules/identity/activation"
  );
  return { ...actual, activateStudentAccount: (...args: unknown[]) => activateStudentAccount(...args) };
});

describe("POST /api/ativar-conta", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("retorna 400 quando faltam token ou senha", async () => {
    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/api/ativar-conta", { method: "POST", body: JSON.stringify({}) }));

    expect(response.status).toBe(400);
    expect(activateStudentAccount).not.toHaveBeenCalled();
  });

  it("ativa com sucesso e repassa o Set-Cookie da sessão real", async () => {
    const headers = new Headers();
    headers.append("Set-Cookie", "better-auth.session_token=abc123; Path=/; HttpOnly");
    activateStudentAccount.mockResolvedValue({ studentId: "s1", tenantId: "t1", headers });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/ativar-conta", {
        method: "POST",
        body: JSON.stringify({ token: "token-do-convite", password: "senha-valida-123" }),
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Set-Cookie")).toContain("better-auth.session_token=abc123");
    expect(activateStudentAccount).toHaveBeenCalledWith({ token: "token-do-convite", password: "senha-valida-123" });
  });

  it("retorna 400 com o motivo quando o token é inválido, sem revelar dado do aluno", async () => {
    const { ActivationError } = await vi.importActual<typeof import("@/modules/identity/activation")>(
      "@/modules/identity/activation"
    );
    activateStudentAccount.mockRejectedValue(new ActivationError("TOKEN_INVALIDO", "Este link não é válido ou já expirou."));

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/ativar-conta", {
        method: "POST",
        body: JSON.stringify({ token: "token-invalido", password: "senha-valida-123" }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "TOKEN_INVALIDO", message: "Este link não é válido ou já expirou." });
  });
});
