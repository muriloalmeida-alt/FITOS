import { describe, expect, it } from "vitest";
import { OPTIONAL_ENV, asaasEnvironment } from "./startupDiagnostics";

describe("startupDiagnostics", () => {
  it("lista as variáveis que o app usa em execução, sem as de escrita do R2", () => {
    expect(OPTIONAL_ENV).toEqual(expect.arrayContaining(["ASAAS_BASE_URL", "RESEND_API_KEY", "EMAIL_FROM", "PAYMENT_KEYS_SECRET", "R2_PUBLIC_BASE_URL"]));
    expect(OPTIONAL_ENV.filter((name) => /^R2_(ENDPOINT|BUCKET_NAME|ACCESS_KEY_ID|SECRET_ACCESS_KEY)$/.test(name))).toEqual([]);
  });

  it("ambiente do Asaas", () => {
    expect(asaasEnvironment({})).toBe("sandbox");
    expect(asaasEnvironment({ ASAAS_BASE_URL: "https://api-sandbox.asaas.com/v3" })).toBe("sandbox");
    expect(asaasEnvironment({ ASAAS_BASE_URL: "https://api.asaas.com/v3" })).toBe("producao");
  });
});
