// @vitest-environment node
//
// Proposta 11 contra PostgreSQL real: programas de Funcional e CrossFit na
// biblioteca do personal (versão 3, aditiva e idempotente) e no Livre
// (blocos e metas do material), recomendação por modalidade e
// preferências com isolamento por espaço.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { ensureCuratedCatalogForTests } from "@/modules/exercises/curatedCatalogForTests";
import { getMyModalities, getStudentModalities, setMyModalities } from "@/modules/students/modalityPreferences";
import { ensureStarterLibrary, STARTER_LIBRARY_VERSION } from "./starterLibrary";
import { MODALITY_PROGRAMS } from "./modalityPrograms";
import { ModalityCatalogError, resolveModalityExercises } from "./modalityProgramCopy";
import { copyReadyItem, getReadyLibrary } from "./readyLibrary";
import { buildRecommendations } from "./recommendations";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

beforeAll(async () => {
  await ensureCuratedCatalogForTests(prisma);
}, 60_000);

afterAll(async () => {
  await prisma.planAssignment.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.workoutExercise.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.workout.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.trainingPlan.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.student.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.individualProfile.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

let counter = 0;
async function tenant(role: "PERSONAL" | "INDIVIDUAL", extra: { starterLibraryVersion?: number } = {}) {
  const label = `${++counter}`;
  const owner = await prisma.user.create({ data: { email: `dono-${label}-${run}@example.test`, name: "Dono", role } });
  return prisma.tenant.create({ data: { ownerId: owner.id, name: `Espaço ${label} ${run}`, type: role, ...extra } });
}

describe("programas de Funcional e CrossFit", () => {
  it("personal com a biblioteca v2 recebe só os 4 programas novos, classificados, com blocos e metas; de novo não duplica", async () => {
    const space = await tenant("PERSONAL", { starterLibraryVersion: 2 });
    expect(await ensureStarterLibrary(space.id, prisma)).toBe(true);
    expect(await ensureStarterLibrary(space.id, prisma)).toBe(false);
    expect(STARTER_LIBRARY_VERSION).toBe(3);

    const plans = await prisma.trainingPlan.findMany({ where: { tenantId: space.id, isDraftBucket: false }, include: { workouts: { orderBy: { position: "asc" }, include: { workoutExercises: { orderBy: { position: "asc" }, include: { exercise: true } } } } } });
    expect(plans.map((plan) => plan.name).sort()).toEqual(MODALITY_PROGRAMS.map((program) => program.name).sort());
    const crossfit = plans.find((plan) => plan.name === "CrossFit — Condicionamento")!;
    expect(crossfit.modalities).toEqual(["crossfit"]);
    expect(crossfit.durationWeeks).toBe(4);
    const [amrap, emom, forTime] = crossfit.workouts;
    expect(amrap!.blocks).toEqual([expect.objectContaining({ kind: "AMRAP", windowSeconds: 720 })]);
    expect(emom!.blocks).toEqual([expect.objectContaining({ kind: "EMOM", intervals: 15, intervalSeconds: 60 })]);
    expect(forTime!.blocks).toEqual([expect.objectContaining({ kind: "FOR_TIME", rounds: 3, timeCapSeconds: 900 })]);
    expect(forTime!.workoutExercises.map((item) => [item.exercise.externalId, item.reps, item.targetDistanceMeters, item.notes])).toEqual([
      ["fitos:wall-ball", 8, null, "adaptado"],
      ["fitos:farmer-carry", null, 30, null],
      ["fitos:aerobico-burpee", 6, null, "sem salto"],
      ["fitos:aerobico-remo", null, 150, null],
    ]);
    // Carga individualizada: nunca prescrita; itens no bloco, sem séries.
    expect(crossfit.workouts.flatMap((workout) => workout.workoutExercises).every((item) => item.load === null && item.sets === null && item.blockKey === "principal")).toBe(true);
  });

  it("exercício faltando no catálogo aborta, nunca pula em silêncio", async () => {
    await expect(resolveModalityExercises(prisma, ["fitos:agachamento-livre", "fitos:nao-existe"])).rejects.toBeInstanceOf(ModalityCatalogError);
  });

  it("Livre: começar um programa de CrossFit copia blocos e metas e arquiva os treinos ativos", async () => {
    const space = await tenant("INDIVIDUAL");
    const library = await getReadyLibrary(prisma);
    const program = library.programs.find((entry) => entry.name === "CrossFit — Fundamentos")!;
    expect(program.lines[1]).toEqual({ name: "Levantar e carregar", dose: "qua · EMOM · 3 exercícios" });
    const result = await copyReadyItem({ tenantId: space.id, kind: "programa", key: program.id }, prisma);
    expect(result.workoutIds).toHaveLength(3);
    const workouts = await prisma.workout.findMany({ where: { tenantId: space.id, status: "ATIVO" }, orderBy: { position: "asc" } });
    expect(workouts.map((workout) => [workout.name, workout.suggestedDays])).toEqual([
      ["Agachar, empurrar e puxar", ["SEGUNDA"]],
      ["Levantar e carregar", ["QUARTA"]],
      ["Ritmo e coordenação", ["SEXTA"]],
    ]);
  });

  it("recomendação: só as modalidades escolhidas; musculação começa pelo plano das respostas; nível compatível primeiro", async () => {
    const base = { objective: "CONDICIONAMENTO_GERAL" as const, experience: "INTERMEDIARIO" as const, availability: "TRES_A_QUATRO_DIAS" as const };
    const crossfit = await buildRecommendations({ ...base, modalities: ["crossfit"] }, prisma);
    expect(crossfit.missing).toEqual([]);
    expect(crossfit.groups.map((group) => group.label)).toEqual(["CrossFit"]);
    expect(crossfit.groups[0]!.options.map((option) => option.name)).toEqual(["CrossFit — Condicionamento", "CrossFit — Fundamentos"]);
    expect(crossfit.groups[0]!.options[0]!.facts).toEqual(["3 dias por semana", "4 semanas", "40–50 min por sessão", "Intermediário"]);

    const mixed = await buildRecommendations({ ...base, modalities: ["musculacao", "funcional"] }, prisma);
    expect(mixed.groups.map((group) => group.label)).toEqual(["Musculação", "Funcional"]);
    expect(mixed.groups[0]!.options[0]!.choice).toEqual({ kind: "inicial" });
    expect(mixed.groups.flatMap((group) => group.options).some((option) => option.name.startsWith("CrossFit"))).toBe(false);
  });
});

describe("preferências de modalidade", () => {
  it("Livre e aluno gravam só na própria conta; recusa vazio e desconhecido; personal só vê alunos do espaço, com divergência", async () => {
    const livre = await tenant("INDIVIDUAL");
    await prisma.individualProfile.create({ data: { tenantId: livre.id, objective: "GANHAR_MASSA", experienceLevel: "INICIANTE", weeklyAvailability: "UM_A_DOIS_DIAS" } });
    expect(await getMyModalities({ role: "INDIVIDUAL", tenantId: livre.id }, prisma)).toEqual([]);
    expect(await setMyModalities({ role: "INDIVIDUAL", tenantId: livre.id }, ["funcional", "musculacao", "funcional"], prisma)).toEqual(["musculacao", "funcional"]);
    await expect(setMyModalities({ role: "INDIVIDUAL", tenantId: livre.id }, [], prisma)).rejects.toThrow(/uma ou mais/);
    await expect(setMyModalities({ role: "INDIVIDUAL", tenantId: livre.id }, ["yoga"], prisma)).rejects.toThrow(/desconhecida/);
    expect(await getMyModalities({ role: "INDIVIDUAL", tenantId: livre.id }, prisma)).toEqual(["musculacao", "funcional"]);

    const coach = await tenant("PERSONAL");
    const other = await tenant("PERSONAL");
    const student = await prisma.student.create({ data: { tenantId: coach.id, email: `aluno-${run}@example.test`, displayName: "Ana" } });
    // Aluno antigo: não definido; nada é atribuído.
    expect(await getStudentModalities({ tenantId: coach.id, studentId: student.id }, prisma)).toEqual({ modalities: [], programModalities: [], divergence: [] });
    await setMyModalities({ role: "ALUNO", tenantId: coach.id, studentId: student.id }, ["funcional"], prisma);
    await expect(setMyModalities({ role: "ALUNO", tenantId: other.id, studentId: student.id }, ["crossfit"], prisma)).rejects.toThrow();
    expect(await getStudentModalities({ tenantId: other.id, studentId: student.id }, prisma)).toBeNull();

    // Programa ativo de CrossFit: continua ativo; a divergência aparece.
    const plan = await prisma.trainingPlan.create({ data: { tenantId: coach.id, name: "CrossFit do aluno", isSnapshot: true, modalities: ["crossfit"] } });
    await prisma.planAssignment.create({ data: { tenantId: coach.id, studentId: student.id, trainingPlanId: plan.id, active: true } });
    expect(await getStudentModalities({ tenantId: coach.id, studentId: student.id }, prisma)).toEqual({ modalities: ["funcional"], programModalities: ["crossfit"], divergence: ["crossfit"] });
    expect(await prisma.planAssignment.count({ where: { studentId: student.id, active: true } })).toBe(1);
  });

  it("o banco recusa id desconhecido mesmo fora do servidor", async () => {
    const coach = await tenant("PERSONAL");
    await expect(prisma.trainingPlan.create({ data: { tenantId: coach.id, name: "x", modalities: ["pilates"] } })).rejects.toThrow();
  });
});
