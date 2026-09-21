import { describe, expect, it } from "vitest";
import { parseCatalogImportRequest, CatalogImportRequestValidationError } from "./catalogImportRequest";

describe("parseCatalogImportRequest (IMP-EX-001)", () => {
  it("aceita dry-run sem autorizadoPor", () => {
    const result = parseCatalogImportRequest({
      environment: "homologacao",
      dryRun: true,
      forceReimport: false,
      autorizarProducao: false,
    });
    expect(result).toEqual({ environment: "HOMOLOGACAO", dryRun: true });
  });

  it("rejeita environment inválido", () => {
    expect(() =>
      parseCatalogImportRequest({ environment: "outro", dryRun: true, forceReimport: false, autorizarProducao: false })
    ).toThrow(CatalogImportRequestValidationError);
  });

  it("exige autorizadoPor fora de dry-run", () => {
    expect(() =>
      parseCatalogImportRequest({ environment: "homologacao", dryRun: false, forceReimport: false, autorizarProducao: false })
    ).toThrow(/autorizadoPor/);
  });

  it("exige autorizarProducao=true para environment producao", () => {
    expect(() =>
      parseCatalogImportRequest({
        environment: "producao",
        dryRun: false,
        autorizadoPor: "Teste",
        forceReimport: false,
        autorizarProducao: false,
      })
    ).toThrow(/autorizarProducao/);
  });

  it("aceita producao com autorizarProducao=true", () => {
    const result = parseCatalogImportRequest({
      environment: "producao",
      dryRun: false,
      autorizadoPor: "Teste",
      forceReimport: false,
      autorizarProducao: true,
    });
    expect(result.environment).toBe("PRODUCAO");
  });

  it("exige justificativa quando forceReimport=true", () => {
    expect(() =>
      parseCatalogImportRequest({
        environment: "homologacao",
        dryRun: false,
        autorizadoPor: "Teste",
        forceReimport: true,
        autorizarProducao: false,
      })
    ).toThrow(/justificativa/);
  });

  it("preenche forceReimportNote quando forceReimport=true e justificativa informada", () => {
    const result = parseCatalogImportRequest({
      environment: "homologacao",
      dryRun: false,
      autorizadoPor: "Teste",
      forceReimport: true,
      justificativa: "autorizado por Murilo",
      autorizarProducao: false,
    });
    expect(result.forceReimportNote).toBe("autorizado por Murilo");
  });
});
