import "server-only";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { DEFAULT_PRESCRIPTION, ensureDraftTrainingPlanForTenant, WorkoutError } from "@/modules/workouts/workouts";
import { estimateMinutes } from "@/modules/students/studentHome";
import { prescriptionLine } from "@/shared/lib/prescription";
import { WEEKDAYS } from "@/shared/lib/weekdays";
import { STARTER_LIBRARY, type StarterItem, type StarterWorkout } from "./starterLibrary";
import type { Library, LibraryEntry } from "./library";

/// Biblioteca pronta do FitOS Livre: os mesmos programas, treinos e
/// aeróbicos que o personal recebe, lidos direto das definições (nunca
/// copiados para o espaço do Livre, onde encheriam "Meus treinos"). Usar
/// um item cria a cópia dele nos treinos do praticante.

type ProgramDef = (typeof STARTER_LIBRARY.programs)[number];
type Kind = "programa" | "treino";

function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/// Chave estável por nome (o índice mudaria se a lista mudar).
function keyed<T extends { name: string }>(defs: T[]): { key: string; def: T }[] {
  const seen = new Map<string, number>();
  return defs.map((def) => {
    const base = slugify(def.name);
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return { key: count === 1 ? base : `${base}-${count}`, def };
  });
}

const PROGRAMS = keyed(STARTER_LIBRARY.programs);
const WORKOUTS = keyed([...STARTER_LIBRARY.workouts, ...STARTER_LIBRARY.cardio]);

type CatalogExercise = { id: string; name: string; type: string | null; imageUrl: string | null };

async function catalog(defs: StarterWorkout[], client: PrismaClient): Promise<Map<string, CatalogExercise>> {
  const slugs = [...new Set(defs.flatMap((def) => def.items.map((item) => item.slug)))];
  const rows = await client.exercise.findMany({ where: { externalId: { in: slugs }, tenantId: null, status: "ATIVO" }, select: { id: true, externalId: true, name: true, type: true, imageUrl: true } });
  return new Map(rows.map((row) => [row.externalId!, row]));
}

function prescription(item: StarterItem) {
  return item.minutes
    ? { sets: null, reps: null, durationSeconds: item.minutes * 60, load: null, restSeconds: null, intensity: item.intensity ?? ("MODERADO" as const) }
    : { sets: item.sets ?? DEFAULT_PRESCRIPTION.sets, reps: item.seconds ? null : (item.reps ?? DEFAULT_PRESCRIPTION.reps), durationSeconds: item.seconds ?? null, load: null, restSeconds: item.rest ?? DEFAULT_PRESCRIPTION.restSeconds, intensity: null };
}

function resolved(def: StarterWorkout, exercises: Map<string, CatalogExercise>) {
  return def.items.flatMap((item) => {
    const exercise = exercises.get(item.slug);
    return exercise ? [{ item, exercise, ...prescription(item) }] : [];
  });
}

const isCardio = (def: StarterWorkout) => def.items.length > 0 && def.items.every((item) => item.minutes);

function daysLabel(days: string[] = []): string {
  return WEEKDAYS.filter((day) => days.includes(day.key)).map((day) => day.short.toLowerCase()).join(" e ");
}

function workoutEntry(key: string, def: StarterWorkout, exercises: Map<string, CatalogExercise>): LibraryEntry {
  const items = resolved(def, exercises);
  const cardio = isCardio(def);
  const minutes = estimateMinutes(items);
  return {
    id: key,
    name: def.name,
    meta: cardio
      ? items.length === 1
        ? prescriptionLine(items[0]!)
        : `${Math.round(items.reduce((sum, entry) => sum + (entry.durationSeconds ?? 0), 0) / 60)} min · ${items.length} etapas`
      : `${items.length} ${items.length === 1 ? "exercício" : "exercícios"} · cerca de ${minutes} min`,
    thumbnails: items.map((entry) => entry.exercise.imageUrl).filter((url): url is string => Boolean(url)).slice(0, 3),
    cardio,
    minutes,
    lines: items.map((entry) => ({ name: entry.exercise.name, dose: prescriptionLine(entry) })),
  };
}

function programEntry(key: string, def: ProgramDef, exercises: Map<string, CatalogExercise>): LibraryEntry {
  const cardio = def.workouts.filter(isCardio).length;
  const strength = def.workouts.length - cardio;
  const head = `${strength} ${strength === 1 ? "treino" : "treinos"}${cardio > 0 ? ` + ${cardio} ${cardio === 1 ? "aeróbico" : "aeróbicos"}` : ""}`;
  const all = def.workouts.flatMap((workout) => resolved(workout, exercises));
  return {
    id: key,
    name: def.name,
    meta: [head, `${def.weeks} semanas`].join(" · "),
    thumbnails: all.map((entry) => entry.exercise.imageUrl).filter((url): url is string => Boolean(url)).slice(0, 3),
    cardio: false,
    minutes: null,
    lines: def.workouts.map((workout) => {
      const items = resolved(workout, exercises);
      const amount = isCardio(workout) ? `${Math.round(items.reduce((sum, entry) => sum + (entry.durationSeconds ?? 0), 0) / 60)} min` : `${items.length} ${items.length === 1 ? "exercício" : "exercícios"}`;
      return { name: workout.name, dose: [daysLabel(workout.days), amount].filter(Boolean).join(" · ") };
    }),
  };
}

export async function getReadyLibrary(client: PrismaClient = prisma): Promise<Library> {
  const exercises = await catalog([...WORKOUTS.map((entry) => entry.def), ...PROGRAMS.flatMap((entry) => entry.def.workouts)], client);
  const sort = (a: LibraryEntry, b: LibraryEntry) => a.name.localeCompare(b.name, "pt-BR");
  const loose = WORKOUTS.map(({ key, def }) => workoutEntry(key, def, exercises));
  return {
    programs: PROGRAMS.map(({ key, def }) => programEntry(key, def, exercises)).sort(sort),
    workouts: loose.filter((entry) => !entry.cardio).sort(sort),
    cardio: loose.filter((entry) => entry.cardio).sort(sort),
  };
}

/// Usa um item da biblioteca pronta no espaço do Livre. Treino ou
/// aeróbico: entra em "Meus treinos". Programa: os treinos ativos vão para
/// Arquivados (voltam quando quiser) e os do programa entram com os dias.
export async function copyReadyItem(input: { tenantId: string; kind: Kind; key: string }, client: PrismaClient = prisma): Promise<{ workoutIds: string[] }> {
  const defs: StarterWorkout[] =
    input.kind === "programa" ? (PROGRAMS.find((entry) => entry.key === input.key)?.def.workouts ?? []) : [WORKOUTS.find((entry) => entry.key === input.key)?.def].filter((def): def is StarterWorkout => Boolean(def));
  if (defs.length === 0) throw new WorkoutError("NAO_ENCONTRADO", "Item não encontrado na biblioteca.");
  const exercises = await catalog(defs, client);
  const plan = await ensureDraftTrainingPlanForTenant(input.tenantId, client);

  return client.$transaction(async (tx) => {
    if (input.kind === "programa") {
      await tx.workout.updateMany({ where: { tenantId: input.tenantId, status: "ATIVO", trainingPlan: { isSnapshot: false } }, data: { status: "ARQUIVADO" } });
    }
    let position = ((await tx.workout.aggregate({ where: { tenantId: input.tenantId, trainingPlanId: plan.id }, _max: { position: true } }))._max.position ?? -1) + 1;
    const workoutIds: string[] = [];
    for (const def of defs) {
      const workout = await tx.workout.create({ data: { tenantId: input.tenantId, trainingPlanId: plan.id, name: def.name, position, suggestedDays: def.days ?? [] } });
      position += 1;
      for (const [index, entry] of resolved(def, exercises).entries()) {
        const { sets, reps, durationSeconds, restSeconds, intensity } = entry;
        await tx.workoutExercise.create({ data: { tenantId: input.tenantId, workoutId: workout.id, exerciseId: entry.exercise.id, position: index, sets, reps, durationSeconds, restSeconds, intensity } });
      }
      workoutIds.push(workout.id);
    }
    return { workoutIds };
  });
}
