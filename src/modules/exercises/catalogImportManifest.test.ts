import { describe, expect, it } from "vitest";
import { buildCatalogImportManifest, hashCatalogImportManifest, CATALOG_IMPORT_MUSCLE_GROUPS } from "./catalogImportManifest";

describe("catalogImportManifest (IMP-EX-001)", () => {
  it("gera uma consulta por grupo muscular documentado, na ordem declarada", () => {
    const manifest = buildCatalogImportManifest();

    expect(manifest.queries).toHaveLength(CATALOG_IMPORT_MUSCLE_GROUPS.length);
    expect(manifest.queries[0]).toEqual({ muscle: CATALOG_IMPORT_MUSCLE_GROUPS[0] });
  });

  it("hash é determinístico para o mesmo manifesto", () => {
    const a = buildCatalogImportManifest();
    const b = buildCatalogImportManifest();

    expect(hashCatalogImportManifest(a)).toBe(hashCatalogImportManifest(b));
  });

  it("hash muda se as consultas mudarem", () => {
    const manifest = buildCatalogImportManifest();
    const changed = { version: manifest.version, queries: [...manifest.queries, { muscle: "forearms" }] };

    expect(hashCatalogImportManifest(manifest)).not.toBe(hashCatalogImportManifest(changed));
  });

  it("hash muda se a versão mudar mesmo com as mesmas consultas", () => {
    const manifest = buildCatalogImportManifest();
    const changed = { version: "v2-outro", queries: manifest.queries };

    expect(hashCatalogImportManifest(manifest)).not.toBe(hashCatalogImportManifest(changed));
  });
});
