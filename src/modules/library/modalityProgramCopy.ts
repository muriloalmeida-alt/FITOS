import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import { MODALITY_PROGRAM_SLUGS, type ModalityWorkout } from "./modalityPrograms";

type Client = PrismaClient | Prisma.TransactionClient;

export class ModalityCatalogError extends Error {
  constructor(public readonly missing: string[]) {
    super(`Exercícios do catálogo não encontrados: ${missing.join(", ")}.`);
    this.name = "ModalityCatalogError";
  }
}

/// Resolve cada exercício dos programas de Funcional e CrossFit no
/// catálogo. Faltar um aborta (nunca pula em silêncio).
export async function resolveModalityExercises(client: Client, slugs: string[] = MODALITY_PROGRAM_SLUGS): Promise<Map<string, string>> {
  const rows = await client.exercise.findMany({ where: { externalId: { in: slugs }, tenantId: null, status: "ATIVO" }, select: { id: true, externalId: true } });
  const idBySlug = new Map(rows.map((row) => [row.externalId!, row.id]));
  const missing = slugs.filter((slug) => !idBySlug.has(slug));
  if (missing.length > 0) throw new ModalityCatalogError(missing);
  return idBySlug;
}

/// Cria um treino de Funcional/CrossFit com os blocos e as metas do
/// material: repetições, tempo ou distância por item; sem séries nem carga.
export async function createModalityWorkout(tx: Prisma.TransactionClient, input: { tenantId: string; planId: string; position: number; def: ModalityWorkout; idBySlug: Map<string, string> }): Promise<string> {
  const { tenantId, def, idBySlug } = input;
  const workout = await tx.workout.create({
    data: { tenantId, trainingPlanId: input.planId, name: def.name, position: input.position, suggestedDays: def.days, blocks: def.blocks as unknown as Prisma.InputJsonValue },
  });
  for (const [position, item] of def.items.entries()) {
    const exerciseId = idBySlug.get(item.slug);
    if (!exerciseId) throw new ModalityCatalogError([item.slug]);
    await tx.workoutExercise.create({
      data: {
        tenantId,
        workoutId: workout.id,
        exerciseId,
        position,
        blockKey: item.block,
        reps: item.reps ?? null,
        durationSeconds: item.seconds ?? null,
        targetDistanceMeters: item.meters ?? null,
        notes: [item.note, item.range].filter(Boolean).join("; ") || null,
      },
    });
  }
  return workout.id;
}
