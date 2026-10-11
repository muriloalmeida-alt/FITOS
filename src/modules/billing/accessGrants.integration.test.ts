// @vitest-environment node
//
// Renovação de gratuidade (feature 4): prévia, concessão idempotente,
// encadeamento, revogação e efeito no acesso. PostgreSQL real.
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { AdminError } from "@/modules/admin/users";
import { subscriptionAccess } from "./access";
import { grantAccess, listAccessGrants, previewAccessGrant, reconcileSyncingGrants, revokeAccessGrant, type GrantDeps } from "./accessGrants";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const now = new Date("2026-10-07T15:00:00Z");
const DAY = 86_400_000;

afterAll(async () => {
  await prisma.adminBenefitAudit.deleteMany({ where: { reason: { contains: run } } });
  await prisma.administrativeAccessGrant.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.saasSubscription.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.plan.deleteMany({ where: { slug: { contains: run } } });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

let counter = 0;
async function owner(options: { role?: "PERSONAL" | "INDIVIDUAL" | "ALUNO"; trialEndsAt?: Date | null; priceCents?: number; externalSubscriptionId?: string | null; subscription?: boolean } = {}) {
  const label = `${++counter}`;
  const role = options.role ?? "INDIVIDUAL";
  const user = await prisma.user.create({ data: { email: `dono-${label}-${run}@example.test`, name: "Rafa", role } });
  if (role === "ALUNO") return user;
  const tenant = await prisma.tenant.create({ data: { ownerId: user.id, name: `Espaço ${label} ${run}`, type: role === "INDIVIDUAL" ? "INDIVIDUAL" : "PERSONAL" } });
  if (options.subscription !== false) {
    const plan = await prisma.plan.create({
      data: { slug: `plano-${label}-${run}`, audience: role === "INDIVIDUAL" ? "INDIVIDUAL" : "PERSONAL", name: "Livre", priceCents: options.priceCents ?? 1990, billingCycle: "MENSAL" },
    });
    await prisma.saasSubscription.create({
      data: {
        tenantId: tenant.id,
        planId: plan.id,
        provider: "sem_integracao",
        externalSubscriptionId: options.externalSubscriptionId ?? null,
        trialEndsAt: options.trialEndsAt === undefined ? new Date(now.getTime() - 10 * DAY) : options.trialEndsAt,
        trialUsedAt: new Date("2026-09-01T00:00:00Z"),
      },
    });
  }
  return user;
}

const admin = "admin-id";
const key = () => `op-${run}-${++counter}`;

async function grant(userId: string, days: number, at = now, operationKey = key()) {
  const preview = await previewAccessGrant({ userId, days }, prisma, at);
  if (!preview.eligible) throw new Error(preview.message);
  return grantAccess({ adminUserId: admin, userId, days, reasonCode: "OUTRO", reasonText: `teste ${run}`, operationKey, revision: preview.revision }, prisma, at);
}

describe("gratuidade concedida pelo administrador", () => {
  it("conta bloqueada: libera já, sem mexer no teste, e grava auditoria", async () => {
    const user = await owner();
    const before = await prisma.saasSubscription.findFirstOrThrow({ where: { tenant: { ownerId: user.id } }, include: { plan: true } });
    expect(subscriptionAccess(before, now).kind).toBe("BLOQUEADO");

    const preview = await previewAccessGrant({ userId: user.id, days: 15 }, prisma, now);
    expect(preview).toMatchObject({ eligible: true, audience: "FitOS Livre", access: "BLOQUEADO", startsAt: now, endsAt: new Date(now.getTime() + 15 * DAY), lastDay: "2026-10-22" });

    const { grant: created, replayed } = await grant(user.id, 15);
    expect(replayed).toBe(false);
    const after = await prisma.saasSubscription.findFirstOrThrow({ where: { tenant: { ownerId: user.id } }, include: { plan: true, accessGrants: true } });
    expect(after.trialEndsAt).toEqual(before.trialEndsAt);
    expect(after.trialUsedAt).toEqual(before.trialUsedAt);
    expect(subscriptionAccess(after, now, after.accessGrants).kind).toBe("LIBERADO");
    expect(await prisma.adminBenefitAudit.count({ where: { grantId: created.id, operation: "CONCEDER", actorId: admin } })).toBe(1);
  });

  it("teste em curso: começa no fim do teste; segunda concessão encadeia", async () => {
    const trialEndsAt = new Date("2026-10-20T15:00:00Z");
    const user = await owner({ role: "PERSONAL", trialEndsAt });
    const first = await grant(user.id, 30);
    expect(first.grant).toMatchObject({ startsAt: trialEndsAt, endsAt: new Date("2026-11-19T15:00:00Z") });
    const second = await grant(user.id, 15);
    expect(second.grant).toMatchObject({ startsAt: new Date("2026-11-19T15:00:00Z"), endsAt: new Date("2026-12-04T15:00:00Z") });
    const history = await listAccessGrants(user.id, prisma, now);
    expect(history.map((row) => row.status)).toEqual(["AGENDADO", "AGENDADO"]);
  });

  it("mesma operationKey (retry ou clique duplo em paralelo) não soma dias", async () => {
    const user = await owner();
    const operationKey = key();
    const preview = await previewAccessGrant({ userId: user.id, days: 30 }, prisma, now);
    if (!preview.eligible) throw new Error("inelegível");
    const send = () => grantAccess({ adminUserId: admin, userId: user.id, days: 30, reasonCode: "SUPORTE", reasonText: run, operationKey, revision: preview.revision }, prisma, now);
    const results = await Promise.all([send(), send()]);
    expect(new Set(results.map((result) => result.grant.id)).size).toBe(1);
    const again = await send();
    expect(again.replayed).toBe(true);
    expect(await prisma.administrativeAccessGrant.count({ where: { tenant: { ownerId: user.id } } })).toBe(1);
  });

  it("prévia desatualizada é recusada", async () => {
    const user = await owner();
    const stale = await previewAccessGrant({ userId: user.id, days: 7 }, prisma, now);
    if (!stale.eligible) throw new Error("inelegível");
    await grant(user.id, 7);
    await expect(
      grantAccess({ adminUserId: admin, userId: user.id, days: 7, reasonCode: "SUPORTE", reasonText: run, operationKey: key(), revision: stale.revision }, prisma, now)
    ).rejects.toMatchObject({ kind: "CONFLITO" });
  });

  it("aluno, sem assinatura, plano gratuito e cobrança no Asaas não recebem", async () => {
    expect(await previewAccessGrant({ userId: (await owner({ role: "ALUNO" })).id, days: 7 }, prisma, now)).toMatchObject({ eligible: false, kind: "SEM_ESPACO" });
    expect(await previewAccessGrant({ userId: (await owner({ subscription: false })).id, days: 7 }, prisma, now)).toMatchObject({ eligible: false, kind: "SEM_ASSINATURA" });
    expect(await previewAccessGrant({ userId: (await owner({ priceCents: 0 })).id, days: 7 }, prisma, now)).toMatchObject({ eligible: false, kind: "PLANO_GRATUITO" });
    const asaas = await owner({ externalSubscriptionId: `sub_${run}` });
    expect(await previewAccessGrant({ userId: asaas.id, days: 7 }, prisma, now)).toMatchObject({ eligible: false, kind: "COBRANCA_EXTERNA" });
    await expect(previewAccessGrant({ userId: asaas.id, days: 400 }, prisma, now)).rejects.toBeInstanceOf(AdminError);
  });

  it("revogar exige motivo, corta o acesso, fica no histórico e não revoga duas vezes", async () => {
    const user = await owner();
    const { grant: created } = await grant(user.id, 30);
    await expect(revokeAccessGrant({ adminUserId: admin, grantId: created.id, reason: " " }, prisma, now)).rejects.toMatchObject({ kind: "VALIDACAO" });
    const revoked = await revokeAccessGrant({ adminUserId: admin, grantId: created.id, reason: `engano ${run}` }, prisma, now);
    expect(revoked.state).toBe("REVOKED");
    await expect(revokeAccessGrant({ adminUserId: admin, grantId: created.id, reason: `de novo ${run}` }, prisma, now)).rejects.toMatchObject({ kind: "CONFLITO" });

    const sub = await prisma.saasSubscription.findFirstOrThrow({ where: { tenant: { ownerId: user.id } }, include: { plan: true, accessGrants: { where: { state: "ACTIVE" } } } });
    expect(subscriptionAccess(sub, now, sub.accessGrants).kind).toBe("BLOQUEADO");
    const [row] = await listAccessGrants(user.id, prisma, now);
    expect(row).toMatchObject({ status: "REVOGADO", revokeReason: `engano ${run}` });
    // Nova concessão depois da revogação começa agora, não no fim da revogada.
    expect((await grant(user.id, 7)).grant.startsAt).toEqual(now);
  });
});

/// Asaas de mentira: assinatura, cobranças e o PUT de `nextDueDate`.
function fakeAsaas(initial: { nextDueDate: string; payments?: { id: string; status: string; dueDate: string; value: number }[]; status?: string }) {
  const state = { ...initial, payments: initial.payments ?? [], status: initial.status ?? "ACTIVE", puts: [] as unknown[], failNextPut: null as null | "rede" | "timeout_aplicado", failGets: false };
  const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
    const path = String(url).replace(/^.*\/v3/, "");
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
    if (init?.method === "PUT") {
      const body = JSON.parse(String(init.body));
      state.puts.push(body);
      const failure = state.failNextPut;
      state.failNextPut = null;
      if (failure === "rede") throw new TypeError("fetch failed");
      state.nextDueDate = body.nextDueDate;
      if (failure === "timeout_aplicado") throw new TypeError("fetch failed");
      return json({ id: "sub_x", status: state.status, nextDueDate: state.nextDueDate, cycle: "MONTHLY" });
    }
    if (state.failGets) throw new TypeError("fetch failed");
    if (path.includes("/payments")) return json({ object: "list", hasMore: false, totalCount: state.payments.length, limit: 100, offset: 0, data: state.payments });
    return json({ id: "sub_x", status: state.status, nextDueDate: state.nextDueDate, cycle: "MONTHLY" });
  }) as typeof fetch;
  const deps: GrantDeps = { apiKey: "chave-teste", fetchImpl, asaasEnabled: true };
  return { state, deps };
}

describe("gratuidade com cobrança no Asaas (fatia 3)", () => {
  async function asaasOwner() {
    return owner({ externalSubscriptionId: `sub_${run}_${counter}`, trialEndsAt: new Date("2026-09-01T15:00:00Z") });
  }
  async function confirm(userId: string, days: number, deps: GrantDeps) {
    const preview = await previewAccessGrant({ userId, days }, prisma, now, deps);
    if (!preview.eligible) throw new Error(preview.message);
    return grantAccess({ adminUserId: admin, userId, days, reasonCode: "RETENCAO", reasonText: run, operationKey: key(), revision: preview.revision }, prisma, now, deps);
  }

  it("pago até 01/11: janela começa no fim do período pago e a próxima cobrança vai para o fim do benefício", async () => {
    const user = await asaasOwner();
    const asaas = fakeAsaas({ nextDueDate: "2026-11-01", payments: [{ id: "pay_1", status: "CONFIRMED", dueDate: "2026-10-01", value: 19.9 }] });
    const preview = await previewAccessGrant({ userId: user.id, days: 30 }, prisma, now, asaas.deps);
    expect(preview).toMatchObject({ eligible: true, startsAt: new Date("2026-11-01T03:00:00Z"), lastDay: "2026-11-30", external: { currentDueDate: "2026-11-01", targetDueDate: "2026-12-01", needsChange: true } });
    if (!preview.eligible) throw new Error();
    expect(preview.billing).toMatch(/passa de 01\/11\/2026 para 01\/12\/2026/);

    const { grant } = await confirm(user.id, 30, asaas.deps);
    expect(grant.state).toBe("ACTIVE");
    expect(asaas.state.puts).toEqual([{ nextDueDate: "2026-12-01", updatePendingPayments: false }]);
    const [row] = await listAccessGrants(user.id, prisma, now);
    expect(row).toMatchObject({ status: "AGENDADO", targetDueDate: "2026-12-01" });
    expect(await prisma.adminBenefitAudit.count({ where: { grantId: grant.id, operation: "SINCRONIZADO" } })).toBe(1);
  });

  it("cobrança já emitida dentro da janela bloqueia sem mudar nada; atraso antigo só é informado", async () => {
    const user = await asaasOwner();
    const asaas = fakeAsaas({ nextDueDate: "2026-11-07", payments: [{ id: "pay_2", status: "PENDING", dueDate: "2026-10-07", value: 19.9 }] });
    const preview = await previewAccessGrant({ userId: user.id, days: 30 }, prisma, now, asaas.deps);
    expect(preview).toMatchObject({ eligible: false, kind: "COBRANCA_EMITIDA" });
    if (preview.eligible) throw new Error();
    expect(preview.message).toMatch(/07\/10\/2026/);
    expect(asaas.state.puts).toEqual([]);

    asaas.state.payments = [{ id: "pay_3", status: "OVERDUE", dueDate: "2026-09-07", value: 19.9 }];
    const ok = await previewAccessGrant({ userId: user.id, days: 30 }, prisma, now, asaas.deps);
    if (!ok.eligible) throw new Error(ok.message);
    expect(ok.billing).toMatch(/Em atraso, continua devido: 07\/09\/2026/);
  });

  it("timeout depois de aplicar: fica SYNCING e a reconciliação confere no Asaas sem repetir o PUT", async () => {
    const user = await asaasOwner();
    const asaas = fakeAsaas({ nextDueDate: "2026-10-08" });
    asaas.state.failNextPut = "timeout_aplicado";
    const { grant } = await confirm(user.id, 15, asaas.deps);
    expect(grant.state).toBe("SYNCING");
    // Enquanto sincroniza: não libera acesso, não aceita outra concessão nem revogação.
    const sub = await prisma.saasSubscription.findFirstOrThrow({ where: { tenant: { ownerId: user.id } }, include: { plan: true, accessGrants: { where: { state: "ACTIVE" } } } });
    expect(subscriptionAccess(sub, now, sub.accessGrants).kind).toBe("BLOQUEADO");
    expect(await previewAccessGrant({ userId: user.id, days: 7 }, prisma, now, asaas.deps)).toMatchObject({ eligible: false, kind: "EM_SINCRONIZACAO" });
    await expect(revokeAccessGrant({ adminUserId: admin, grantId: grant.id, reason: `x ${run}` }, prisma, now)).rejects.toMatchObject({ kind: "CONFLITO" });

    expect(await reconcileSyncingGrants(prisma, asaas.deps, { id: grant.id })).toBe(1);
    expect(asaas.state.puts).toHaveLength(1);
    expect((await prisma.administrativeAccessGrant.findUniqueOrThrow({ where: { id: grant.id } })).state).toBe("ACTIVE");
  });

  it("falha de rede: tenta de novo na reconciliação e, depois de 3 tentativas, FAILED sem tirar acesso existente", async () => {
    const user = await asaasOwner();
    const asaas = fakeAsaas({ nextDueDate: "2026-10-08" });
    asaas.state.failNextPut = "rede";
    const { grant } = await confirm(user.id, 15, asaas.deps);
    expect(grant.state).toBe("SYNCING");
    asaas.state.failGets = true;
    await reconcileSyncingGrants(prisma, asaas.deps, { id: grant.id });
    await reconcileSyncingGrants(prisma, asaas.deps, { id: grant.id });
    const failed = await prisma.administrativeAccessGrant.findUniqueOrThrow({ where: { id: grant.id } });
    expect(failed).toMatchObject({ state: "FAILED", syncAttempts: 3 });
    const [row] = await listAccessGrants(user.id, prisma, now);
    expect(row).toMatchObject({ status: "FALHOU" });
    expect(row!.syncError).toBeTruthy();
  });

  it("Asaas fora do ar na prévia: avisa e não deixa conceder; com o ajuste desligado, segue bloqueado", async () => {
    const user = await asaasOwner();
    const asaas = fakeAsaas({ nextDueDate: "2026-10-08" });
    asaas.state.failGets = true;
    expect(await previewAccessGrant({ userId: user.id, days: 7 }, prisma, now, asaas.deps)).toMatchObject({ eligible: false, kind: "ASAAS_INDISPONIVEL" });
    expect(await previewAccessGrant({ userId: user.id, days: 7 }, prisma, now, { ...asaas.deps, asaasEnabled: false })).toMatchObject({ eligible: false, kind: "COBRANCA_EXTERNA" });
  });
});
