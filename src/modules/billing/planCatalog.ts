import "server-only";
import type { Plan, PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";

/// Catálogo oficial de planos comerciais (FIT-090/FIT-122/FIT-127). Fonte
/// única de verdade sobre quais planos existem e seus valores — nunca
/// hardcoded em rota ou UI, sempre lido da tabela `plans` via
/// `listActivePlansForAudience` (`plans.ts`). `ensurePlanCatalog` é a única
/// função autorizada a escrever aqui: reconcilia esta lista por upsert
/// (`slug` como chave), nunca cria um segundo plano para o mesmo slug nem
/// apaga um plano existente que não esteja mais nesta lista.
///
/// **Preço nunca muda por `UPDATE` num slug já ativo** (ADR-013 — corrige a
/// citação equivocada de "ADR-005", que documenta outro domínio inteiramente
/// diferente: versionamento de `TrainingPlan`). Uma mudança de oferta
/// sempre cria um slug novo com `active: true` e marca o(s) slug(s)
/// anterior(es) como `active: false` aqui mesmo — nunca remove nem
/// sobrescreve preço de um slug em uso. Um tenant com assinatura num slug
/// desativado continua exatamente na mesma condição até que ele mesmo
/// escolha trocar de plano.
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
  active: boolean;
}

export const PLAN_CATALOG: readonly PlanCatalogEntry[] = [
  // Geração 1 (ADR-010, FIT-122) — preço zero, decisão deliberada de
  // "mecânica sem gateway". Desativados pela FIT-127: nunca removidos da
  // lista (quem já assina continua exatamente como está), nunca mais
  // oferecidos para nova contratação/troca.
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
    active: false,
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
    active: false,
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
    active: false,
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
    active: false,
  },

  // Geração 2 (FIT-127/EPIC-16) — preços reais, 30 dias de teste grátis.
  {
    slug: "personal-20",
    audience: "PERSONAL",
    name: "Personal 20",
    description: "Até 20 alunos ativos.",
    priceCents: 4990,
    billingCycle: "MENSAL",
    studentLimit: 20,
    trialDays: 30,
    position: 1,
    active: true,
  },
  {
    slug: "personal-50",
    audience: "PERSONAL",
    name: "Personal 50",
    description: "Até 50 alunos ativos.",
    priceCents: 6990,
    billingCycle: "MENSAL",
    studentLimit: 50,
    trialDays: 30,
    position: 2,
    active: true,
  },
  {
    slug: "personal-ilimitado-v2",
    audience: "PERSONAL",
    name: "Personal Ilimitado",
    description: "Sem limite de alunos ativos.",
    priceCents: 9990,
    billingCycle: "MENSAL",
    studentLimit: null,
    trialDays: 30,
    position: 3,
    active: true,
  },
  {
    slug: "individual-livre-v2",
    audience: "INDIVIDUAL",
    name: "FitOS Livre",
    description: "Treine sozinho, sem personal, com todo o FitOS.",
    priceCents: 1990,
    billingCycle: "MENSAL",
    studentLimit: null,
    trialDays: 30,
    position: 1,
    active: true,
  },
] as const;

/// Reconcilia a tabela `plans` com `PLAN_CATALOG` — upsert idempotente por
/// `slug`, seguro para rodar em qualquer ambiente (dev, seed, produção)
/// quantas vezes for preciso. Nunca desativa um plano que tenha saído desta
/// lista (isso seria uma decisão de produto, não uma consequência automática
/// de deploy) — só cria os que faltam e atualiza os campos dos existentes,
/// incluindo `active` (é assim que a desativação de uma geração antiga é
/// aplicada, ver ADR-013).
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
        active: entry.active,
      },
    });
    results.push(plan);
  }
  return results;
}
