import { describe, expect, it } from "vitest";
import { resolvePublicBaseUrl } from "./publicBaseUrl";

describe("endereço público dos links", () => {
  it("variável configurada com domínio real vale", () => {
    expect(resolvePublicBaseUrl({ configured: "https://app.fitos.com.br/", host: "fitos-web-hml.up.railway.app" })).toBe("https://app.fitos.com.br");
  });

  it("variável ausente ou em localhost num acesso público usa o endereço acessado (https)", () => {
    expect(resolvePublicBaseUrl({ configured: "http://localhost:3000", forwardedHost: "fitos-web-hml.up.railway.app", forwardedProto: "https" })).toBe("https://fitos-web-hml.up.railway.app");
    expect(resolvePublicBaseUrl({ configured: null, host: "fitos.app" })).toBe("https://fitos.app");
    expect(resolvePublicBaseUrl({ configured: undefined, forwardedHost: "a.example, b.example", forwardedProto: "https, http" })).toBe("https://a.example");
  });

  it("desenvolvimento local continua em localhost", () => {
    expect(resolvePublicBaseUrl({ configured: "http://localhost:3000", host: "localhost:3000" })).toBe("http://localhost:3000");
    expect(resolvePublicBaseUrl({ configured: null, host: "localhost:3000" })).toBe("http://localhost:3000");
    expect(resolvePublicBaseUrl({})).toBe("http://localhost:3000");
  });
});
