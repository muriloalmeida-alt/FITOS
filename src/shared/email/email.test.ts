// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { sendEmail, emailConfigured, DEFAULT_EMAIL_FROM } = await import("./send");
const { passwordResetEmail } = await import("./templates");

const email = { to: "ana@example.test", subject: "Assunto", html: "<p>Oi</p>", text: "Oi" };

describe("sendEmail (Resend)", () => {
  it("sem RESEND_API_KEY não envia", async () => {
    const fetchImpl = vi.fn();
    expect(emailConfigured({})).toBe(false);
    expect(await sendEmail(email, { env: {}, fetchImpl: fetchImpl as unknown as typeof fetch })).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("envia pela API com a chave e o remetente", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ id: "1" }), { status: 200 }));
    expect(await sendEmail(email, { env: { RESEND_API_KEY: "re_123", EMAIL_FROM: "FitOS <oi@fitos.test>" }, fetchImpl: fetchImpl as unknown as typeof fetch })).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_123");
    expect(JSON.parse(String(init.body))).toEqual({ from: "FitOS <oi@fitos.test>", to: ["ana@example.test"], subject: "Assunto", html: "<p>Oi</p>", text: "Oi" });
  });

  it("sem EMAIL_FROM usa o remetente padrão; recusa ou falha de rede devolvem false", async () => {
    const ok = vi.fn(async () => new Response("{}", { status: 200 }));
    await sendEmail(email, { env: { RESEND_API_KEY: "re_123" }, fetchImpl: ok as unknown as typeof fetch });
    expect(JSON.parse(String((ok.mock.calls[0] as unknown as [string, RequestInit])[1].body)).from).toBe(DEFAULT_EMAIL_FROM);
    const refused = vi.fn(async () => new Response("domínio não verificado", { status: 403 }));
    expect(await sendEmail(email, { env: { RESEND_API_KEY: "re_123" }, fetchImpl: refused as unknown as typeof fetch })).toBe(false);
    const offline = vi.fn(async () => { throw new Error("offline"); });
    expect(await sendEmail(email, { env: { RESEND_API_KEY: "re_123" }, fetchImpl: offline as unknown as typeof fetch })).toBe(false);
  });
});

describe("passwordResetEmail", () => {
  it("leva o link, o prazo e escapa o nome", () => {
    const message = passwordResetEmail({ to: "ana@example.test", name: "Ana <b>Souza</b>", url: "https://app.fitos.test/redefinir-senha?token=abc&x=1", minutes: 60 });
    expect(message.subject).toBe("Crie uma nova senha no FitOS");
    expect(message.html).toContain('href="https://app.fitos.test/redefinir-senha?token=abc&amp;x=1"');
    expect(message.html).toContain("Oi, Ana!");
    expect(message.html).not.toContain("<b>");
    expect(message.text).toContain("https://app.fitos.test/redefinir-senha?token=abc&x=1");
    expect(message.text).toContain("60 minutos");
  });
});
