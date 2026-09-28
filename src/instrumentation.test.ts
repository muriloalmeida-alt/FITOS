import { afterEach, describe, expect, it, vi } from "vitest";

const runAsaasSandboxDiagnostic = vi.fn().mockResolvedValue(undefined);

vi.mock("@/modules/billing/asaasSandboxDiagnostic", () => ({
  runAsaasSandboxDiagnostic: (...args: unknown[]) => runAsaasSandboxDiagnostic(...args),
}));

describe("register (instrumentation, FIT-128 diagnóstico temporário)", () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllEnvs();
    delete process.env.NEXT_RUNTIME;
  });

  it("dispara o diagnóstico do Asaas sem aguardar a promise (nunca atrasa o servidor ficar pronto)", async () => {
    delete process.env.NEXT_RUNTIME;
    const { register } = await import("./instrumentation");

    const result = register();

    expect(result).toBeUndefined();
    expect(runAsaasSandboxDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: process.env.API_ASAAS, fetchImpl: fetch })
    );
  });

  it("nunca dispara o diagnóstico no runtime edge", async () => {
    process.env.NEXT_RUNTIME = "edge";
    const { register } = await import("./instrumentation");

    register();

    expect(runAsaasSandboxDiagnostic).not.toHaveBeenCalled();
  });
});
