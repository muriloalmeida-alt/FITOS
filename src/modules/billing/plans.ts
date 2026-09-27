import "server-only";
import type { Plan, PrismaClient, TenantType } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";

/// Catálogo de planos comerciais (FIT-090/FIT-122). Leitura pura — a
/// escrita (versionamento de oferta) é responsabilidade de
/// `planCatalog.ts`, nunca desta função nem de nenhuma rota HTTP.
///
/// Só planos `active` aparecem para nova contratação/troca — um plano
/// retirado (`active=false`) nunca é oferecido de novo, mas continua
/// existindo para quem já o assina (`SaasSubscription.planId` aponta para
/// ele normalmente, sem quebrar a referência).
export async function listActivePlansForAudience(audience: TenantType, client: PrismaClient = prisma): Promise<Plan[]> {
  return client.plan.findMany({
    where: { audience, active: true },
    orderBy: [{ position: "asc" }, { name: "asc" }],
  });
}

export async function getPlanById(planId: string, client: PrismaClient = prisma): Promise<Plan | null> {
  return client.plan.findUnique({ where: { id: planId } });
}
