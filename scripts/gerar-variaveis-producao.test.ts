import { describe, expect, it } from "vitest";
import { productionEnv } from "./gerar-variaveis-producao";

const fixed = (bytes: number) => Buffer.alloc(bytes, 7);
const vapid = { publicKey: "PUB", privateKey: "PRIV" };

describe("productionEnv", () => {
  it("gera segredos, valores de produção e deixa comentadas as chaves de serviços externos", () => {
    const env = productionEnv({ adminEmail: "admin@fitosx.com.br", contactEmail: null, random: fixed, vapid });
    const active = Object.fromEntries(env.split("\n").filter((line) => /^[A-Z_]+=/.test(line)).map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]));
    expect(active).toMatchObject({
      BETTER_AUTH_URL: "https://app.fitosx.com.br",
      NEXT_PUBLIC_APP_ENV: "production",
      ADMIN_EMAIL: "admin@fitosx.com.br",
      VAPID_PUBLIC_KEY: "PUB",
      VAPID_PRIVATE_KEY: "PRIV",
      VAPID_SUBJECT: "mailto:admin@fitosx.com.br",
      EMAIL_FROM: "FitOS <nao-responda@fitosx.com.br>",
    });
    expect(active.PAYMENT_KEYS_SECRET).toBe(Buffer.alloc(32, 7).toString("base64"));
    expect(active.ADMIN_PASSWORD!.length).toBeGreaterThanOrEqual(24);
    for (const name of ["RESEND_API_KEY", "API_ASAAS", "ASAAS_BASE_URL", "API_ASAAS_WEBHOOK_TOKEN", "SENTRY_DSN", "DATABASE_URL", "BETTER_AUTH_SECRET"]) expect(active[name]).toBeUndefined();
    expect(env).toMatch(/^# API_ASAAS_WEBHOOK_TOKEN=[0-9a-f]{64}$/m);
  });

  it("sem e-mail de admin, deixa ADMIN_EMAIL e VAPID_SUBJECT para preencher", () => {
    const env = productionEnv({ adminEmail: null, contactEmail: null, random: fixed, vapid });
    expect(env).toMatch(/^# ADMIN_EMAIL=/m);
    expect(env).toMatch(/^# VAPID_SUBJECT=/m);
  });
});
