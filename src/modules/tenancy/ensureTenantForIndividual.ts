import "server-only";
import { Prisma, PrismaClient, type Tenant } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";

interface IndividualUser {
  id: string;
  name: string;
  role: string;
}

/// Mesma regra de nomenclatura de `ensureTenantForPersonal` (FIT-010),
/// aplicada ao workspace `INDIVIDUAL` (FIT-100).
function tenantNameFor(individualName: string): string {
  const firstName = individualName.trim().split(/\s+/)[0];
  return `Espaço de ${firstName || "Praticante"}`;
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/// Garante que `user` (obrigatoriamente `INDIVIDUAL`) possua exatamente um
/// tenant do tipo `INDIVIDUAL`, criando-o se necessário. Mesmo padrão de
/// idempotência/concorrência de `ensureTenantForPersonal` — a constraint
/// física `tenants.ownerId @unique` (FIT-007, vale para qualquer `type`)
/// rejeita uma segunda criação concorrente; a chamada perdedora só busca e
/// retorna o tenant que a vencedora criou.
///
/// Não cria nenhum `Student` nem qualquer outro dado de treino aqui —
/// "criar o workspace" (FIT-100) é deliberadamente só isso; a decisão de
/// como o próprio praticante se relaciona com `Workout`/`WorkoutSession`
/// (reaproveitar `Student` como auto-referência, ou outra modelagem) é da
/// FIT-102, quando essa necessidade concreta existir — ver nota de
/// transparência em `docs/06-engenharia/arquitetura/adr/
/// ADR-006-WORKSPACE-INDIVIDUAL.md`.
export async function ensureTenantForIndividual(user: IndividualUser, client: PrismaClient = prisma): Promise<Tenant> {
  if (user.role !== "INDIVIDUAL") {
    throw new Error("Apenas usuários com papel INDIVIDUAL podem ter um workspace individual provisionado automaticamente.");
  }

  const existing = await client.tenant.findUnique({ where: { ownerId: user.id } });
  if (existing) {
    return existing;
  }

  try {
    return await client.tenant.create({
      data: { ownerId: user.id, name: tenantNameFor(user.name), type: "INDIVIDUAL" },
    });
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      return client.tenant.findUniqueOrThrow({ where: { ownerId: user.id } });
    }
    throw error;
  }
}
