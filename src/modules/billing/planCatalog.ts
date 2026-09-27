import "server-only";
import type { Plan, PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";

/// Catálogo oficial de planos comerciais (FIT-090/FIT-122). Fonte única de
/// verdade sobre quais planos existem e seus valores — nunca hardcoded em
/// rota ou UI, sempre lido da tabela `plans` via `listActivePlansForAudience`
/// (`plans.ts`). `ensurePlanCatalog` é a única função autorizada a escrever
/// aqui: reconcilia esta lista por upsert (`slug` como chave), nunca cria um
/// segundo plano para o mesmo slug nem apaga um plano existente que não
/// esteja mais nesta lista (retirar um plano é editar `active: false` aqui,
/// nunca removê-lo da tabela — "versionamento de oferta", ver comentário do
/// model `Plan`).
///
/// Todos os preços começam zerados (decisão de produto: "criar toda a
/// mecânica deixando a integração de pagamento para depois") — a integração
/// real (Asaas/Mercado Pago, FIT-091) decide os valores finais depois, sem
/// mudar esta estrutura.
export interface PlanCatalogEntry {
  slug: string;
  audience: Plan["audience"];
  name: string;
  description: string | null;
  priceCents: number;
  billingCycle: Plan["billingCycle"];
  studentLimit: number | null;
  trialDays: number | null;
  position: number;
}

export const PLAN_CATALOG: readonly PlanCatalogEntry[] = [
  {
    slug: "personal-essencial",
    audience: "PERSONAL",
    name: "Essencial",
    description: "Para quem está começando a organizar os alunos no FitOS.",
    priceCents: 0,
    billingCycle: "MENSAL",
    studentLimit: 20,
    trialDays: null,
    position: 1,
  },
  {
    slug: "personal-profissional",
    audience: "PERSONAL",
    name: "Profissional",
    description: "Para personal trainers com uma base maior de alunos ativos.",
    priceCents: 0,
    billingCycle: "MENSAL",
    studentLimit: 50,
    trialDays: null,
    position: 2,
  },
  {
    slug: "personal-ilimitado",
    audience: "PERSONAL",
    name: "Ilimitado",
    description: "Sem limite de alunos ativos.",
    priceCents: 0,
    billingCycle: "MENSAL",
    studentLimit: null,
    trialDays: null,
    position: 3,
  },
  {
    slug: "individual-livre",
    audience: "INDIVIDUAL",
    name: "FitOS Livre",
    description: "Treine sozinho, sem personal, com todo o FitOS.",
    priceCents: 0,
    billingCycle: "MENSAL",
    studentLimit: null,
    trialDays: null,
    position: 1,
  },
] as const;

/// Reconcilia a tabela `plans` com `PLAN_CATALOG` — upsert idempotente por
/// `slug`, seguro para rodar em qualquer ambiente (dev, seed, produção)
/// quantas vezes for preciso. Nunca desativa um plano que tenha saído desta
/// lista (isso seria uma decisão de produto, não uma consequência automática
/// de deploy) — só cria os que faltam e atualiza os campos dos existentes.
export async function ensurePlanCatalog(client: PrismaClient = prisma): Promise<Plan[]> {
  const results: Plan[] = [];
  for (const entry of PLAN_CATALOG) {
    const plan = await client.plan.upsert({
      where: { slug: entry.slug },
      create: entry,
      update: {
        audience: entry.audience,
        name: entry.name,
        description: entry.description,
        priceCents: entry.priceCents,
        billingCycle: entry.billingCycle,
        studentLimit: entry.studentLimit,
        trialDays: entry.trialDays,
        position: entry.position,
      },
    });
    results.push(plan);
  }
  return results;
}
