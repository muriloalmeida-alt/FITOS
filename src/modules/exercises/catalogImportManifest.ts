import { createHash } from "node:crypto";
import type { SearchExercisesInput } from "@/integrations/api-ninjas";

/// IMP-EX-001, seção 3: quando o fornecedor não oferece endpoint de
/// exportação integral (não oferece — ver ADR-004: `GET /v1/allexercises`
/// exige plano Business/anual e só devolve nomes por grupo muscular, não
/// objetos completos), o pacote exige um "manifesto versionado de consultas
/// por dimensões documentadas". A única dimensão com valores efetivamente
/// documentados e já testados neste repositório (ADR-004, FIT-021) é
/// `muscle` — os valores aceitos por `type`/`difficulty`/`equipments` nunca
/// foram confirmados por consulta independente (o acesso a api-ninjas.com
/// está bloqueado pelo proxy de egresso deste ambiente, ver ADR-004) e por
/// isso não entram no manifesto: inventar enumerações não confirmadas
/// arriscaria consultas malformadas ou uma falsa impressão de cobertura
/// maior do que a real. Ampliar para outras dimensões é trabalho futuro,
/// condicionado a uma reconsulta confirmada da documentação oficial.
export const CATALOG_IMPORT_MANIFEST_VERSION = "v1-muscle-groups";

/// Mesmos 10 grupos musculares já usados como padrão em
/// `scripts/import-exercicios.ts` desde a FIT-021 — preservados aqui como a
/// única fonte da verdade; o script agora importa deste módulo em vez de
/// manter sua própria lista solta.
export const CATALOG_IMPORT_MUSCLE_GROUPS = [
  "biceps",
  "triceps",
  "chest",
  "back",
  "shoulders",
  "quadriceps",
  "hamstrings",
  "glutes",
  "calves",
  "abdominals",
] as const;

export interface CatalogImportManifest {
  version: string;
  queries: SearchExercisesInput[];
}

export function buildCatalogImportManifest(): CatalogImportManifest {
  return {
    version: CATALOG_IMPORT_MANIFEST_VERSION,
    queries: CATALOG_IMPORT_MUSCLE_GROUPS.map((muscle) => ({ muscle })),
  };
}

/// Hash determinístico do manifesto (versão + consultas, na ordem
/// declarada) — registrado em `CatalogImportRun.manifestHash` para que uma
/// retomada (`FAILED` → `RUNNING`) só continue uma execução que usou
/// exatamente o mesmo conjunto de consultas; um manifesto alterado entre a
/// falha e a retomada deve iniciar uma nova execução, nunca continuar o
/// checkpoint de um manifesto diferente.
export function hashCatalogImportManifest(manifest: CatalogImportManifest): string {
  const canonical = JSON.stringify({
    version: manifest.version,
    queries: manifest.queries,
  });
  return createHash("sha256").update(canonical).digest("hex");
}
