// @vitest-environment node
//
// Testes de integração de contratação/troca/cancelamento de assinatura SaaS
// (FIT-122) contra PostgreSQL real (banco de testes).
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import {
  ASAAS_PROVIDER,
  NO_PAYMENT_PROVIDER,
  cancelSubscription,
  getSubscriptionForTenant,
  subscribeTenantToPlan,
} from "./subscriptions";

const FAKE_KEY = "$aact_sandbox_fake_key_never_real_1234567890";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

/// Mock de `fetch` que roteia por método/URL, imitando as respostas reais
/// do Asaas v3 documentadas — nunca exercido contra a API real (só a
/// leitura foi, via o diagnóstico da FIT-128). Cada rota tem uma resposta
/// padrão de sucesso, substituível por `overrides` para simular falhas.
function createAsaasFetchMock(
  overrides: Partial<Record<"findCustomer" | "createCustomer" | "createSubscription" | "updateSubscription" | "cancelSubscription", () => Response | Promise<Response>>> = {}
) {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (method === "GET" && url.includes("/customers?cpfCnpj=")) {
      return (
        (await overrides.findCustomer?.()) ??
        jsonResponse(200, { object: "list", hasMore: false, totalCount: 0, limit: 10, offset: 0, data: [] })
      );
    }
    if (method === "POST" && url.endsWith("/customers")) {
      return (await overrides.createCustomer?.()) ?? jsonResponse(200, { id: "cus_1", name: "Tenant", cpfCnpj: "11144477735" });
    }
    if (method === "POST" && url.endsWith("/subscriptions")) {
      return (await overrides.createSubscription?.()) ?? jsonResponse(200, { id: "sub_1", customer: "cus_1", status: "ACTIVE" });
    }
    if (method === "PUT" && url.includes("/subscriptions/")) {
      return (await overrides.updateSubscription?.()) ?? jsonResponse(200, { id: "sub_1", customer: "cus_1", status: "ACTIVE" });
    }
    if (method === "DELETE" && url.includes("/subscriptions/")) {
      return (await overrides.cancelSubscription?.()) ?? jsonResponse(200, { deleted: true });
    }
    throw new Error(`URL não mapeada no mock: ${method} ${url}`);
  });
}

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });

const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

afterAll(async () => {
  await prisma.saasSubscription.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.auditEvent.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.plan.deleteMany({ where: { slug: { contains: run } } });
  await prisma.$disconnect();
});

async function createTenant(label: string, type: "PERSONAL" | "INDIVIDUAL" = "PERSONAL") {
  const owner = await prisma.user.create({
    data: { email: `dono-${label}-${run}@example.test`, name: `Dono ${label}`, role: type },
  });
  const tenant = await prisma.tenant.create({ data: { ownerId: owner.id, name: `Tenant ${label} ${run}`, type } });
  return { owner, tenant };
}

async function createPlan(
  label: string,
  overrides: Partial<{
    audience: "PERSONAL" | "INDIVIDUAL";
    active: boolean;
    studentLimit: number | null;
    trialDays: number | null;
    priceCents: number;
  }> = {}
) {
  return prisma.plan.create({
    data: {
      slug: `${run}-${label}`,
      audience: overrides.audience ?? "PERSONAL",
      name: `Plano ${label}`,
      billingCycle: "MENSAL",
      active: overrides.active ?? true,
      studentLimit: overrides.studentLimit,
      trialDays: overrides.trialDays,
      priceCents: overrides.priceCents ?? 0,
    },
  });
}

async function createPersonalProfile(tenantId: string, cpfCnpj: string | null) {
  await prisma.personalProfile.create({
    data: {
      tenantId,
      phone: "(11) 91234-5678",
      cpfCnpj,
      studentRangeEstimate: "ATE_20",
      termsAcceptedAt: new Date(),
    },
  });
}

async function createActiveStudent(tenantId: string, label: string) {
  return prisma.student.create({
    data: { tenantId, email: `aluno-${label}-${run}@example.test`, displayName: `Aluno ${label}`, status: "ATIVO" },
  });
}

describe("subscribeTenantToPlan (FIT-122)", () => {
  it("contrata um plano pela primeira vez e registra AuditEvent", async () => {
    const { tenant, owner } = await createTenant("contratar");
    const plano = await createPlan("contratar");

    const assinatura = await subscribeTenantToPlan(
      { tenantId: tenant.id, tenantType: "PERSONAL", planId: plano.id, actorUserId: owner.id },
      prisma
    );

    expect(assinatura.planId).toBe(plano.id);
    expect(assinatura.status).toBe("ATIVA");
    expect(assinatura.provider).toBe(NO_PAYMENT_PROVIDER);

    const audit = await prisma.auditEvent.findFirst({ where: { entityType: "SaasSubscription", entityId: assinatura.id } });
    expect(audit?.action).toBe("ASSINATURA_CONTRATADA");
  });

  it("troca de plano reaproveitando a mesma linha (tenantId único)", async () => {
    const { tenant, owner } = await createTenant("trocar");
    const planoA = await createPlan("trocar-a");
    const planoB = await createPlan("trocar-b");

    const primeira = await subscribeTenantToPlan(
      { tenantId: tenant.id, tenantType: "PERSONAL", planId: planoA.id, actorUserId: owner.id },
      prisma
    );
    const segunda = await subscribeTenantToPlan(
      { tenantId: tenant.id, tenantType: "PERSONAL", planId: planoB.id, actorUserId: owner.id },
      prisma
    );

    expect(segunda.id).toBe(primeira.id);
    expect(segunda.planId).toBe(planoB.id);

    const total = await prisma.saasSubscription.count({ where: { tenantId: tenant.id } });
    expect(total).toBe(1);
  });

  it("reativa uma assinatura cancelada ao contratar de novo", async () => {
    const { tenant, owner } = await createTenant("reativar");
    const plano = await createPlan("reativar");
    await subscribeTenantToPlan({ tenantId: tenant.id, tenantType: "PERSONAL", planId: plano.id, actorUserId: owner.id }, prisma);
    await cancelSubscription({ tenantId: tenant.id, actorUserId: owner.id, reason: "Motivo qualquer" }, prisma);

    const reativada = await subscribeTenantToPlan(
      { tenantId: tenant.id, tenantType: "PERSONAL", planId: plano.id, actorUserId: owner.id },
      prisma
    );

    expect(reativada.status).toBe("ATIVA");
    expect(reativada.canceledAt).toBeNull();
    expect(reativada.canceledReason).toBeNull();
  });

  it("rejeita plano de audiência incompatível (AUDIENCIA_INCOMPATIVEL)", async () => {
    const { tenant, owner } = await createTenant("audiencia", "PERSONAL");
    const planoIndividual = await createPlan("audiencia", { audience: "INDIVIDUAL" });

    await expect(
      subscribeTenantToPlan({ tenantId: tenant.id, tenantType: "PERSONAL", planId: planoIndividual.id, actorUserId: owner.id }, prisma)
    ).rejects.toMatchObject({ kind: "AUDIENCIA_INCOMPATIVEL" });
  });

  it("rejeita plano inativo para nova contratação (PLANO_INATIVO)", async () => {
    const { tenant, owner } = await createTenant("inativo");
    const planoInativo = await createPlan("inativo", { active: false });

    await expect(
      subscribeTenantToPlan({ tenantId: tenant.id, tenantType: "PERSONAL", planId: planoInativo.id, actorUserId: owner.id }, prisma)
    ).rejects.toMatchObject({ kind: "PLANO_INATIVO" });
  });

  it("rejeita plano inexistente (NAO_ENCONTRADO)", async () => {
    const { tenant, owner } = await createTenant("inexistente");

    await expect(
      subscribeTenantToPlan(
        { tenantId: tenant.id, tenantType: "PERSONAL", planId: `plano-inexistente-${run}`, actorUserId: owner.id },
        prisma
      )
    ).rejects.toMatchObject({ kind: "NAO_ENCONTRADO" });
  });

  it("FIT-127: concede trial na primeira contratação de um plano com trialDays", async () => {
    const { tenant, owner } = await createTenant("trial-primeira");
    const plano = await createPlan("trial-primeira", { trialDays: 30 });

    const antes = new Date();
    const assinatura = await subscribeTenantToPlan(
      { tenantId: tenant.id, tenantType: "PERSONAL", planId: plano.id, actorUserId: owner.id },
      prisma
    );

    expect(assinatura.trialUsedAt).not.toBeNull();
    expect(assinatura.trialEndsAt).not.toBeNull();
    const diasDeTrial = Math.round((assinatura.trialEndsAt!.getTime() - antes.getTime()) / (24 * 60 * 60 * 1000));
    expect(diasDeTrial).toBe(30);
  });

  it("FIT-127: plano sem trialDays nunca concede trial", async () => {
    const { tenant, owner } = await createTenant("sem-trial");
    const plano = await createPlan("sem-trial", { trialDays: null });

    const assinatura = await subscribeTenantToPlan(
      { tenantId: tenant.id, tenantType: "PERSONAL", planId: plano.id, actorUserId: owner.id },
      prisma
    );

    expect(assinatura.trialUsedAt).toBeNull();
    expect(assinatura.trialEndsAt).toBeNull();
  });

  it("FIT-127: trocar de plano nunca concede um novo trial nem reinicia a contagem (trialUsedAt já setado)", async () => {
    const { tenant, owner } = await createTenant("trial-troca");
    const planoA = await createPlan("trial-troca-a", { trialDays: 30 });
    const planoB = await createPlan("trial-troca-b", { trialDays: 30 });

    const primeira = await subscribeTenantToPlan(
      { tenantId: tenant.id, tenantType: "PERSONAL", planId: planoA.id, actorUserId: owner.id },
      prisma
    );
    const segunda = await subscribeTenantToPlan(
      { tenantId: tenant.id, tenantType: "PERSONAL", planId: planoB.id, actorUserId: owner.id },
      prisma
    );

    expect(segunda.trialUsedAt?.getTime()).toBe(primeira.trialUsedAt?.getTime());
    expect(segunda.trialEndsAt?.getTime()).toBe(primeira.trialEndsAt?.getTime());
  });

  it("FIT-127: rejeita troca para plano com studentLimit menor que a quantidade de alunos ativos (LIMITE_ABAIXO_DO_USO_ATUAL)", async () => {
    const { tenant, owner } = await createTenant("downgrade");
    const planoAmplo = await createPlan("downgrade-amplo", { studentLimit: 50 });
    const planoRestrito = await createPlan("downgrade-restrito", { studentLimit: 1 });
    await subscribeTenantToPlan({ tenantId: tenant.id, tenantType: "PERSONAL", planId: planoAmplo.id, actorUserId: owner.id }, prisma);
    await createActiveStudent(tenant.id, "downgrade-1");
    await createActiveStudent(tenant.id, "downgrade-2");

    await expect(
      subscribeTenantToPlan({ tenantId: tenant.id, tenantType: "PERSONAL", planId: planoRestrito.id, actorUserId: owner.id }, prisma)
    ).rejects.toMatchObject({ kind: "LIMITE_ABAIXO_DO_USO_ATUAL" });
  });

  it("FIT-127: permite troca quando a quantidade de alunos ativos está dentro do novo limite", async () => {
    const { tenant, owner } = await createTenant("downgrade-ok");
    const planoAmplo = await createPlan("downgrade-ok-amplo", { studentLimit: 50 });
    const planoMenor = await createPlan("downgrade-ok-menor", { studentLimit: 5 });
    await subscribeTenantToPlan({ tenantId: tenant.id, tenantType: "PERSONAL", planId: planoAmplo.id, actorUserId: owner.id }, prisma);
    await createActiveStudent(tenant.id, "downgrade-ok-1");

    const trocada = await subscribeTenantToPlan(
      { tenantId: tenant.id, tenantType: "PERSONAL", planId: planoMenor.id, actorUserId: owner.id },
      prisma
    );

    expect(trocada.planId).toBe(planoMenor.id);
  });
});

describe("subscribeTenantToPlan — ligação de melhor esforço ao Asaas (FIT-128)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sem API_ASAAS configurada, mantém NO_PAYMENT_PROVIDER mesmo com plano de preço real (PERSONAL)", async () => {
    const { tenant, owner } = await createTenant("asaas-sem-chave");
    const plano = await createPlan("asaas-sem-chave", { priceCents: 4990 });
    await createPersonalProfile(tenant.id, "111.444.777-35");

    const assinatura = await subscribeTenantToPlan(
      { tenantId: tenant.id, tenantType: "PERSONAL", planId: plano.id, actorUserId: owner.id },
      prisma,
      {}
    );

    expect(assinatura.provider).toBe(NO_PAYMENT_PROVIDER);
    expect(assinatura.externalCustomerId).toBeNull();
    expect(assinatura.externalSubscriptionId).toBeNull();
  });

  it("plano de preço zero nunca tenta a ligação real, mesmo com CPF/CNPJ e chave configurados", async () => {
    const { tenant, owner } = await createTenant("asaas-preco-zero");
    const plano = await createPlan("asaas-preco-zero", { priceCents: 0 });
    await createPersonalProfile(tenant.id, "111.444.777-35");
    const fetchImpl = createAsaasFetchMock();

    const assinatura = await subscribeTenantToPlan(
      { tenantId: tenant.id, tenantType: "PERSONAL", planId: plano.id, actorUserId: owner.id },
      prisma,
      { apiKey: FAKE_KEY, fetchImpl }
    );

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(assinatura.provider).toBe(NO_PAYMENT_PROVIDER);
  });

  it("tenant PERSONAL sem CPF/CNPJ informado nunca tenta a ligação real", async () => {
    const { tenant, owner } = await createTenant("asaas-sem-cpf");
    const plano = await createPlan("asaas-sem-cpf", { priceCents: 4990 });
    await createPersonalProfile(tenant.id, null);
    const fetchImpl = createAsaasFetchMock();

    const assinatura = await subscribeTenantToPlan(
      { tenantId: tenant.id, tenantType: "PERSONAL", planId: plano.id, actorUserId: owner.id },
      prisma,
      { apiKey: FAKE_KEY, fetchImpl }
    );

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(assinatura.provider).toBe(NO_PAYMENT_PROVIDER);
  });

  it("tenant INDIVIDUAL nunca tenta a ligação real, mesmo com plano de preço real e chave configurada", async () => {
    const { tenant, owner } = await createTenant("asaas-individual", "INDIVIDUAL");
    const plano = await createPlan("asaas-individual", { audience: "INDIVIDUAL", priceCents: 1990 });
    const fetchImpl = createAsaasFetchMock();

    const assinatura = await subscribeTenantToPlan(
      { tenantId: tenant.id, tenantType: "INDIVIDUAL", planId: plano.id, actorUserId: owner.id },
      prisma,
      { apiKey: FAKE_KEY, fetchImpl }
    );

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(assinatura.provider).toBe(NO_PAYMENT_PROVIDER);
  });

  it("PERSONAL com plano pago, CPF/CNPJ e chave: cria cliente e assinatura reais no Asaas", async () => {
    const { tenant, owner } = await createTenant("asaas-sucesso");
    const plano = await createPlan("asaas-sucesso", { priceCents: 4990 });
    await createPersonalProfile(tenant.id, "111.444.777-35");
    const fetchImpl = createAsaasFetchMock();

    const assinatura = await subscribeTenantToPlan(
      { tenantId: tenant.id, tenantType: "PERSONAL", planId: plano.id, actorUserId: owner.id },
      prisma,
      { apiKey: FAKE_KEY, fetchImpl }
    );

    expect(assinatura.provider).toBe(ASAAS_PROVIDER);
    expect(assinatura.externalCustomerId).toBe("cus_1");
    expect(assinatura.externalSubscriptionId).toBe("sub_1");
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining("/customers?cpfCnpj="),
      expect.objectContaining({ method: "GET" })
    );
    expect(fetchImpl).toHaveBeenCalledWith("https://api-sandbox.asaas.com/v3/customers", expect.objectContaining({ method: "POST" }));
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api-sandbox.asaas.com/v3/subscriptions",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("reaproveita um cliente Asaas já existente pelo CPF/CNPJ (nunca duplica o cadastro)", async () => {
    const { tenant, owner } = await createTenant("asaas-reaproveita-cliente");
    const plano = await createPlan("asaas-reaproveita-cliente", { priceCents: 4990 });
    await createPersonalProfile(tenant.id, "111.444.777-35");
    const fetchImpl = createAsaasFetchMock({
      findCustomer: () =>
        jsonResponse(200, {
          object: "list",
          hasMore: false,
          totalCount: 1,
          limit: 10,
          offset: 0,
          data: [{ id: "cus_existente", name: "Tenant", cpfCnpj: "11144477735" }],
        }),
    });

    const assinatura = await subscribeTenantToPlan(
      { tenantId: tenant.id, tenantType: "PERSONAL", planId: plano.id, actorUserId: owner.id },
      prisma,
      { apiKey: FAKE_KEY, fetchImpl }
    );

    expect(assinatura.externalCustomerId).toBe("cus_existente");
    expect(fetchImpl).not.toHaveBeenCalledWith("https://api-sandbox.asaas.com/v3/customers", expect.objectContaining({ method: "POST" }));
  });

  it("troca de plano numa assinatura já ligada ao Asaas: atualiza a assinatura existente (PUT), nunca cria cliente/assinatura de novo", async () => {
    const { tenant, owner } = await createTenant("asaas-troca");
    const planoA = await createPlan("asaas-troca-a", { priceCents: 4990 });
    const planoB = await createPlan("asaas-troca-b", { priceCents: 6990 });
    await createPersonalProfile(tenant.id, "111.444.777-35");
    const fetchImpl = createAsaasFetchMock();
    await subscribeTenantToPlan(
      { tenantId: tenant.id, tenantType: "PERSONAL", planId: planoA.id, actorUserId: owner.id },
      prisma,
      { apiKey: FAKE_KEY, fetchImpl }
    );
    fetchImpl.mockClear();

    const trocada = await subscribeTenantToPlan(
      { tenantId: tenant.id, tenantType: "PERSONAL", planId: planoB.id, actorUserId: owner.id },
      prisma,
      { apiKey: FAKE_KEY, fetchImpl }
    );

    expect(trocada.externalCustomerId).toBe("cus_1");
    expect(trocada.externalSubscriptionId).toBe("sub_1");
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api-sandbox.asaas.com/v3/subscriptions/sub_1",
      expect.objectContaining({ method: "PUT" })
    );
    expect(fetchImpl).not.toHaveBeenCalledWith(expect.stringContaining("/customers"), expect.anything());
    expect(fetchImpl).not.toHaveBeenCalledWith("https://api-sandbox.asaas.com/v3/subscriptions", expect.objectContaining({ method: "POST" }));
  });

  it("falha do Asaas (ex.: erro de rede) nunca bloqueia a contratação — nunca lança, volta para NO_PAYMENT_PROVIDER", async () => {
    const { tenant, owner } = await createTenant("asaas-falha-rede");
    const plano = await createPlan("asaas-falha-rede", { priceCents: 4990 });
    await createPersonalProfile(tenant.id, "111.444.777-35");
    const fetchImpl = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    const assinatura = await subscribeTenantToPlan(
      { tenantId: tenant.id, tenantType: "PERSONAL", planId: plano.id, actorUserId: owner.id },
      prisma,
      { apiKey: FAKE_KEY, fetchImpl }
    );

    expect(assinatura.provider).toBe(NO_PAYMENT_PROVIDER);
    expect(assinatura.externalCustomerId).toBeNull();
    expect(assinatura.externalSubscriptionId).toBeNull();
  });

  it("falha do Asaas (resposta de erro HTTP) nunca bloqueia a contratação", async () => {
    const { tenant, owner } = await createTenant("asaas-falha-http");
    const plano = await createPlan("asaas-falha-http", { priceCents: 4990 });
    await createPersonalProfile(tenant.id, "111.444.777-35");
    const fetchImpl = createAsaasFetchMock({
      createCustomer: () => jsonResponse(401, { errors: [{ code: "invalid_access_token", description: "Chave inválida." }] }),
    });

    const assinatura = await subscribeTenantToPlan(
      { tenantId: tenant.id, tenantType: "PERSONAL", planId: plano.id, actorUserId: owner.id },
      prisma,
      { apiKey: FAKE_KEY, fetchImpl }
    );

    expect(assinatura.provider).toBe(NO_PAYMENT_PROVIDER);
  });
});

describe("cancelSubscription (FIT-122)", () => {
  it("cancela, registra motivo e AuditEvent", async () => {
    const { tenant, owner } = await createTenant("cancelar");
    const plano = await createPlan("cancelar");
    await subscribeTenantToPlan({ tenantId: tenant.id, tenantType: "PERSONAL", planId: plano.id, actorUserId: owner.id }, prisma);

    const cancelada = await cancelSubscription({ tenantId: tenant.id, actorUserId: owner.id, reason: "Não preciso mais" }, prisma);

    expect(cancelada.status).toBe("CANCELADA");
    expect(cancelada.canceledReason).toBe("Não preciso mais");
    expect(cancelada.canceledAt).not.toBeNull();
    const audit = await prisma.auditEvent.findFirst({ where: { entityType: "SaasSubscription", entityId: cancelada.id, action: "ASSINATURA_CANCELADA" } });
    expect(audit).not.toBeNull();
  });

  it("é idempotente: cancelar de novo não gera um segundo AuditEvent", async () => {
    const { tenant, owner } = await createTenant("cancelar-idempotente");
    const plano = await createPlan("cancelar-idempotente");
    await subscribeTenantToPlan({ tenantId: tenant.id, tenantType: "PERSONAL", planId: plano.id, actorUserId: owner.id }, prisma);
    await cancelSubscription({ tenantId: tenant.id, actorUserId: owner.id, reason: "Motivo original" }, prisma);

    await cancelSubscription({ tenantId: tenant.id, actorUserId: owner.id, reason: "Motivo ignorado" }, prisma);

    const eventos = await prisma.auditEvent.count({
      where: { entityType: "SaasSubscription", action: "ASSINATURA_CANCELADA", tenantId: tenant.id },
    });
    expect(eventos).toBe(1);
    const assinatura = await getSubscriptionForTenant(tenant.id, prisma);
    expect(assinatura?.canceledReason).toBe("Motivo original");
  });

  it("rejeita motivo vazio (VALIDACAO)", async () => {
    const { tenant, owner } = await createTenant("motivo-vazio");
    const plano = await createPlan("motivo-vazio");
    await subscribeTenantToPlan({ tenantId: tenant.id, tenantType: "PERSONAL", planId: plano.id, actorUserId: owner.id }, prisma);

    await expect(cancelSubscription({ tenantId: tenant.id, actorUserId: owner.id, reason: "   " }, prisma)).rejects.toMatchObject({
      kind: "VALIDACAO",
    });
  });

  it("rejeita tenant sem assinatura (NAO_ENCONTRADO)", async () => {
    const { tenant, owner } = await createTenant("sem-assinatura");

    await expect(
      cancelSubscription({ tenantId: tenant.id, actorUserId: owner.id, reason: "Qualquer" }, prisma)
    ).rejects.toMatchObject({ kind: "NAO_ENCONTRADO" });
  });
});

describe("cancelSubscription — cancelamento remoto de melhor esforço no Asaas (FIT-128)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("chama DELETE no Asaas quando a assinatura tem externalSubscriptionId, e cancela localmente", async () => {
    const { tenant, owner } = await createTenant("asaas-cancelar");
    const plano = await createPlan("asaas-cancelar", { priceCents: 4990 });
    await createPersonalProfile(tenant.id, "111.444.777-35");
    const fetchImpl = createAsaasFetchMock();
    await subscribeTenantToPlan({ tenantId: tenant.id, tenantType: "PERSONAL", planId: plano.id, actorUserId: owner.id }, prisma, {
      apiKey: FAKE_KEY,
      fetchImpl,
    });
    fetchImpl.mockClear();

    const cancelada = await cancelSubscription({ tenantId: tenant.id, actorUserId: owner.id, reason: "Não preciso mais" }, prisma, {
      apiKey: FAKE_KEY,
      fetchImpl,
    });

    expect(cancelada.status).toBe("CANCELADA");
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api-sandbox.asaas.com/v3/subscriptions/sub_1",
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("cancela localmente mesmo quando a chamada remota ao Asaas falha — nunca bloqueia o usuário", async () => {
    const { tenant, owner } = await createTenant("asaas-cancelar-falha");
    const plano = await createPlan("asaas-cancelar-falha", { priceCents: 4990 });
    await createPersonalProfile(tenant.id, "111.444.777-35");
    const fetchImpl = createAsaasFetchMock();
    await subscribeTenantToPlan({ tenantId: tenant.id, tenantType: "PERSONAL", planId: plano.id, actorUserId: owner.id }, prisma, {
      apiKey: FAKE_KEY,
      fetchImpl,
    });
    const failingFetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    const cancelada = await cancelSubscription({ tenantId: tenant.id, actorUserId: owner.id, reason: "Não preciso mais" }, prisma, {
      apiKey: FAKE_KEY,
      fetchImpl: failingFetch,
    });

    expect(cancelada.status).toBe("CANCELADA");
    expect(cancelada.canceledReason).toBe("Não preciso mais");
  });

  it("nunca chama o Asaas quando a assinatura não tem externalSubscriptionId (nunca esteve ligada ao provedor)", async () => {
    const { tenant, owner } = await createTenant("asaas-cancelar-sem-ligacao");
    const plano = await createPlan("asaas-cancelar-sem-ligacao");
    await subscribeTenantToPlan({ tenantId: tenant.id, tenantType: "PERSONAL", planId: plano.id, actorUserId: owner.id }, prisma);
    const fetchImpl = vi.fn();

    await cancelSubscription({ tenantId: tenant.id, actorUserId: owner.id, reason: "Não preciso mais" }, prisma, {
      apiKey: FAKE_KEY,
      fetchImpl,
    });

    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("getSubscriptionForTenant (FIT-122)", () => {
  it("retorna a assinatura com o plano incluído", async () => {
    const { tenant, owner } = await createTenant("consultar");
    const plano = await createPlan("consultar");
    await subscribeTenantToPlan({ tenantId: tenant.id, tenantType: "PERSONAL", planId: plano.id, actorUserId: owner.id }, prisma);

    const assinatura = await getSubscriptionForTenant(tenant.id, prisma);

    expect(assinatura?.plan?.id).toBe(plano.id);
  });

  it("retorna null quando o tenant nunca assinou", async () => {
    const { tenant } = await createTenant("nunca-assinou");

    const assinatura = await getSubscriptionForTenant(tenant.id, prisma);

    expect(assinatura).toBeNull();
  });
});
