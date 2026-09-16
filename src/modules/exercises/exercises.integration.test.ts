// @vitest-environment node
//
// Testes de integração da gestão de exercícios próprios (FIT-022) contra
// PostgreSQL real (banco de testes).
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import {
  archiveExercise,
  createOwnExercise,
  getOwnExerciseForTenant,
  reactivateExercise,
  updateOwnExercise,
} from "./exercises";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });

const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

afterAll(async () => {
  await prisma.exercise.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

async function createTenant(label: string) {
  const owner = await prisma.user.create({
    data: { email: `dono-${label}-${run}@example.test`, name: `Dono ${label}`, role: "PERSONAL" },
  });
  const tenant = await prisma.tenant.create({ data: { ownerId: owner.id, name: `Tenant ${label} ${run}` } });
  return { owner, tenant };
}

describe("createOwnExercise (FIT-022)", () => {
  it("cadastra um exercício próprio, sempre origin PERSONAL e status ATIVO", async () => {
    const { owner, tenant } = await createTenant("criar");

    const exercise = await createOwnExercise(
      { tenantId: tenant.id, actorUserId: owner.id, name: `Rosca direta ${run}`, muscle: "bíceps" },
      prisma
    );

    expect(exercise.origin).toBe("PERSONAL");
    expect(exercise.status).toBe("ATIVO");
    expect(exercise.tenantId).toBe(tenant.id);
    expect(exercise.externalId).toBeNull();
    expect(exercise.muscle).toBe("bíceps");
  });

  it("rejeita nome vazio", async () => {
    const { owner, tenant } = await createTenant("nome-vazio");

    await expect(
      createOwnExercise({ tenantId: tenant.id, actorUserId: owner.id, name: "   " }, prisma)
    ).rejects.toMatchObject({ kind: "VALIDACAO" });
  });

  it("duplicidade dentro do mesmo tenant (mesmo nome, normalizado): rejeitada", async () => {
    const { owner, tenant } = await createTenant("duplicidade");
    const name = `Supino reto ${run}`;

    await createOwnExercise({ tenantId: tenant.id, actorUserId: owner.id, name }, prisma);

    await expect(
      createOwnExercise({ tenantId: tenant.id, actorUserId: owner.id, name: name.toUpperCase() }, prisma)
    ).rejects.toMatchObject({ kind: "NOME_DUPLICADO_NO_TENANT" });
  });

  it("mesmo nome em tenants diferentes: permitido (isolamento)", async () => {
    const tenantA = await createTenant("isolamento-a");
    const tenantB = await createTenant("isolamento-b");
    const name = `Agachamento livre ${run}`;

    const exerciseA = await createOwnExercise({ tenantId: tenantA.tenant.id, actorUserId: tenantA.owner.id, name }, prisma);
    const exerciseB = await createOwnExercise({ tenantId: tenantB.tenant.id, actorUserId: tenantB.owner.id, name }, prisma);

    expect(exerciseA.id).not.toBe(exerciseB.id);
  });
});

describe("getOwnExerciseForTenant (FIT-022)", () => {
  it("nunca retorna exercício de outro tenant", async () => {
    const tenantA = await createTenant("cruzado-a");
    const tenantB = await createTenant("cruzado-b");
    const exercise = await createOwnExercise(
      { tenantId: tenantA.tenant.id, actorUserId: tenantA.owner.id, name: `Puxada alta ${run}` },
      prisma
    );

    const found = await getOwnExerciseForTenant({ tenantId: tenantB.tenant.id, exerciseId: exercise.id }, prisma);
    expect(found).toBeNull();
  });

  it("nunca retorna exercício global (origin API_NINJAS), mesmo com o tenantId correto", async () => {
    const { tenant } = await createTenant("global-oculto");
    const globalExercise = await prisma.exercise.create({
      data: { tenantId: null, origin: "API_NINJAS", name: `Push-up global ${run}` },
    });

    const found = await getOwnExerciseForTenant({ tenantId: tenant.id, exerciseId: globalExercise.id }, prisma);
    expect(found).toBeNull();

    await prisma.exercise.delete({ where: { id: globalExercise.id } });
  });
});

describe("updateOwnExercise (FIT-022)", () => {
  it("edita campos informados, preserva tenantId/origin/status", async () => {
    const { owner, tenant } = await createTenant("editar");
    const exercise = await createOwnExercise(
      { tenantId: tenant.id, actorUserId: owner.id, name: `Remada curvada ${run}`, muscle: "dorsais" },
      prisma
    );

    const updated = await updateOwnExercise(
      { tenantId: tenant.id, actorUserId: owner.id, exerciseId: exercise.id, muscle: "costas" },
      prisma
    );

    expect(updated.muscle).toBe("costas");
    expect(updated.name).toBe(exercise.name);
    expect(updated.tenantId).toBe(tenant.id);
    expect(updated.origin).toBe("PERSONAL");
    expect(updated.status).toBe("ATIVO");
  });

  it("aluno adulterando tenant/id de outro tenant: NAO_ENCONTRADO (nunca revela o registro)", async () => {
    const tenantA = await createTenant("editar-cruzado-a");
    const tenantB = await createTenant("editar-cruzado-b");
    const exercise = await createOwnExercise(
      { tenantId: tenantA.tenant.id, actorUserId: tenantA.owner.id, name: `Leg press ${run}` },
      prisma
    );

    await expect(
      updateOwnExercise(
        { tenantId: tenantB.tenant.id, actorUserId: tenantB.owner.id, exerciseId: exercise.id, muscle: "quadríceps" },
        prisma
      )
    ).rejects.toMatchObject({ kind: "NAO_ENCONTRADO" });
  });

  it("nunca aceita mudar tenantId ou origin (nenhum parâmetro para isso)", async () => {
    const { owner, tenant } = await createTenant("imutavel");
    const exercise = await createOwnExercise(
      { tenantId: tenant.id, actorUserId: owner.id, name: `Elevação lateral ${run}` },
      prisma
    );

    // updateOwnExercise não tem tenantId/origin no tipo de entrada — a
    // única forma de "testar" a ausência é confirmar que o exercício
    // permanece exatamente com o tenant/origin originais após uma edição.
    const updated = await updateOwnExercise(
      { tenantId: tenant.id, actorUserId: owner.id, exerciseId: exercise.id, type: "isolado" },
      prisma
    );
    expect(updated.tenantId).toBe(tenant.id);
    expect(updated.origin).toBe("PERSONAL");
  });
});

describe("archiveExercise / reactivateExercise (FIT-022)", () => {
  it("arquiva e reativa; idempotente; nunca exclusão física", async () => {
    const { owner, tenant } = await createTenant("ciclo-vida");
    const exercise = await createOwnExercise(
      { tenantId: tenant.id, actorUserId: owner.id, name: `Cadeira extensora ${run}` },
      prisma
    );

    const archived = await archiveExercise({ tenantId: tenant.id, actorUserId: owner.id, exerciseId: exercise.id }, prisma);
    expect(archived.status).toBe("ARQUIVADO");

    // Idempotente: arquivar de novo não é erro.
    const archivedAgain = await archiveExercise(
      { tenantId: tenant.id, actorUserId: owner.id, exerciseId: exercise.id },
      prisma
    );
    expect(archivedAgain.status).toBe("ARQUIVADO");

    const reactivated = await reactivateExercise(
      { tenantId: tenant.id, actorUserId: owner.id, exerciseId: exercise.id },
      prisma
    );
    expect(reactivated.status).toBe("ATIVO");

    // Idempotente: reativar de novo não é erro.
    const reactivatedAgain = await reactivateExercise(
      { tenantId: tenant.id, actorUserId: owner.id, exerciseId: exercise.id },
      prisma
    );
    expect(reactivatedAgain.status).toBe("ATIVO");

    const stillExists = await prisma.exercise.findUnique({ where: { id: exercise.id } });
    expect(stillExists).not.toBeNull();
  });

  it("arquivar exercício de outro tenant: NAO_ENCONTRADO", async () => {
    const tenantA = await createTenant("arquivar-cruzado-a");
    const tenantB = await createTenant("arquivar-cruzado-b");
    const exercise = await createOwnExercise(
      { tenantId: tenantA.tenant.id, actorUserId: tenantA.owner.id, name: `Stiff ${run}` },
      prisma
    );

    await expect(
      archiveExercise({ tenantId: tenantB.tenant.id, actorUserId: tenantB.owner.id, exerciseId: exercise.id }, prisma)
    ).rejects.toMatchObject({ kind: "NAO_ENCONTRADO" });
  });

  it("registra auditoria em arquivar/reativar (nunca payload integral)", async () => {
    const { owner, tenant } = await createTenant("auditoria");
    const exercise = await createOwnExercise(
      { tenantId: tenant.id, actorUserId: owner.id, name: `Panturrilha ${run}` },
      prisma
    );

    await archiveExercise({ tenantId: tenant.id, actorUserId: owner.id, exerciseId: exercise.id }, prisma);
    await reactivateExercise({ tenantId: tenant.id, actorUserId: owner.id, exerciseId: exercise.id }, prisma);

    const events = await prisma.auditEvent.findMany({
      where: { tenantId: tenant.id, entityType: "Exercise", entityId: exercise.id },
      orderBy: { occurredAt: "asc" },
    });
    expect(events.map((e) => e.action)).toEqual(["EXERCICIO_ARQUIVADO", "EXERCICIO_REATIVADO"]);
  });

  it("exercício inexistente: NAO_ENCONTRADO em todas as operações", async () => {
    const { owner, tenant } = await createTenant("inexistente");

    await expect(
      updateOwnExercise({ tenantId: tenant.id, actorUserId: owner.id, exerciseId: "id-que-nao-existe", name: "x" }, prisma)
    ).rejects.toMatchObject({ kind: "NAO_ENCONTRADO" });
    await expect(
      archiveExercise({ tenantId: tenant.id, actorUserId: owner.id, exerciseId: "id-que-nao-existe" }, prisma)
    ).rejects.toMatchObject({ kind: "NAO_ENCONTRADO" });
    await expect(
      reactivateExercise({ tenantId: tenant.id, actorUserId: owner.id, exerciseId: "id-que-nao-existe" }, prisma)
    ).rejects.toMatchObject({ kind: "NAO_ENCONTRADO" });
  });
});
