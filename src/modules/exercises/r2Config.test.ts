// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  R2ConfigError,
  buildExerciseObjectKey,
  buildPublicImageUrl,
  listMissingR2EnvVars,
  readR2Config,
  REQUIRED_R2_ENV_VARS,
} from "./r2Config";

const ALL_VARS = [...REQUIRED_R2_ENV_VARS, "R2_REGION"] as const;
const originalValues: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const name of ALL_VARS) {
    originalValues[name] = process.env[name];
    delete process.env[name];
  }
});

afterEach(() => {
  for (const name of ALL_VARS) {
    if (originalValues[name] === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = originalValues[name];
    }
  }
});

function setAllRequiredVars(overrides: Partial<Record<string, string>> = {}): void {
  process.env.R2_ACCOUNT_ID = overrides.R2_ACCOUNT_ID ?? "conta-exemplo";
  process.env.R2_ACCESS_KEY_ID = overrides.R2_ACCESS_KEY_ID ?? "chave-exemplo";
  process.env.R2_SECRET_ACCESS_KEY = overrides.R2_SECRET_ACCESS_KEY ?? "segredo-exemplo-nunca-real";
  process.env.R2_BUCKET_NAME = overrides.R2_BUCKET_NAME ?? "fitos-exercicios";
  process.env.R2_ENDPOINT = overrides.R2_ENDPOINT ?? "https://conta-exemplo.r2.cloudflarestorage.com";
  process.env.R2_PUBLIC_BASE_URL = overrides.R2_PUBLIC_BASE_URL ?? "https://media.fitos.example.com";
}

describe("readR2Config", () => {
  it("lança R2ConfigError citando só o nome da variável ausente, nunca um valor", () => {
    setAllRequiredVars();
    delete process.env.R2_ACCESS_KEY_ID;

    let caught: unknown;
    try {
      readR2Config();
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(R2ConfigError);
    expect((caught as Error).message).toContain("R2_ACCESS_KEY_ID");
    expect((caught as Error).message).not.toContain("chave-exemplo");
  });

  it("aplica fallback 'auto' para R2_REGION quando ausente", () => {
    setAllRequiredVars();
    const config = readR2Config();
    expect(config.region).toBe("auto");
  });

  it("usa R2_REGION explícito quando presente", () => {
    setAllRequiredVars();
    process.env.R2_REGION = "weur";
    const config = readR2Config();
    expect(config.region).toBe("weur");
  });

  it("normaliza barra final de R2_ENDPOINT e R2_PUBLIC_BASE_URL", () => {
    setAllRequiredVars({
      R2_ENDPOINT: "https://conta-exemplo.r2.cloudflarestorage.com/",
      R2_PUBLIC_BASE_URL: "https://media.fitos.example.com/",
    });
    const config = readR2Config();
    expect(config.endpoint).toBe("https://conta-exemplo.r2.cloudflarestorage.com");
    expect(config.publicBaseUrl).toBe("https://media.fitos.example.com");
  });
});

describe("listMissingR2EnvVars", () => {
  it("lista todas as obrigatórias quando nenhuma está definida", () => {
    expect(listMissingR2EnvVars().sort()).toEqual([...REQUIRED_R2_ENV_VARS].sort());
  });

  it("não inclui R2_REGION (tem fallback, não é obrigatória)", () => {
    expect(listMissingR2EnvVars()).not.toContain("R2_REGION");
  });

  it("retorna vazio quando todas as obrigatórias estão definidas", () => {
    setAllRequiredVars();
    expect(listMissingR2EnvVars()).toEqual([]);
  });
});

describe("buildExerciseObjectKey", () => {
  it("gera uma chave determinística com a extensão real do arquivo", () => {
    expect(buildExerciseObjectKey("agachamento-livre", "webp")).toBe("exercises/agachamento-livre.webp");
    expect(buildExerciseObjectKey("agachamento-livre", "png")).toBe("exercises/agachamento-livre.png");
  });
});

describe("buildPublicImageUrl", () => {
  it("concatena base pública + chave do objeto sem barra duplicada", () => {
    const config = { publicBaseUrl: "https://media.fitos.example.com" };
    expect(buildPublicImageUrl(config, "exercises/agachamento-livre.webp")).toBe(
      "https://media.fitos.example.com/exercises/agachamento-livre.webp"
    );
  });
});
