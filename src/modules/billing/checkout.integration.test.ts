// @vitest-environment node
//
// Testes de integração do checkout embutido de cartão (FIT-128) contra
// PostgreSQL real (banco de testes).
import { afterAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { NO_PAYMENT_PROVIDER, ASAAS_PROVIDER } from "./subscriptions";
import { attachCreditCardToSubscription } from "./checkout";

const FAKE_KEY = "$aact_sandbox_fake_key_never_real_1234567890";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

function createAsaasFetchMock(
  overrides: Partial<Record<"tokenize" | "updateSubscription", () => Response | Promise<Response>>> = {}
) {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (method === "POST" && url.endsWith("/creditCard/tokenize")) {
      return (await overrides.tokenize?.()) ?? jsonResponse(200, { creditCardNumber: "1111", creditCardBrand: "VISA", creditCardToken: "tok_1" });
    }
    if (method === "PUT" && url.includes("/subscriptions/")) {
      return (await overrides.updateSubscription?.()) ?? jsonResponse(200, { id: "sub_1", customer: "cus_1", status: "ACTIVE" });
    }
    throw new Error(`URL não mapeada no mock: ${method} ${url}`);
  });
}

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

afterAll(async () => {
  await prisma.saasSubscription.deleteMany({ where: { tenant: { name: { contains: run } } } });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.plan.deleteMany({ where: { slug: { contains: run } } });
  await prisma.$disconnect();
});

const CARD_FIELDS = {
  cardHolderName: "Fulano de Tal",
  cardNumber: "4111111111111111",
  cardExpiryMonth: "10",
  cardExpiryYear: "2030",
  cardCcv: "123",
  postalCode: "01310100",
  addressNumber: "100",
  phone: "11912345678",
};

async function createTenant(label: string, type: "PERSONAL" | "INDIVIDUAL" = "PERSONAL") {
  const owner = await prisma.user.create({
    data: { email: `dono-${label}-${run}@example.test`, name: `Dono ${label}`, role: type },
  });
  const tenant = await prisma.tenant.create({ data: { ownerId: owner.id, name: `Tenant ${label} ${run}`, type } });
  return { owner, tenant };
}

async function createPlan(label: string) {
  return prisma.plan.create({
    data: { slug: `${run}-${label}`, audience: "PERSONAL", name: `Plano ${label}`, billingCycle: "MENSAL", active: true, priceCents: 4990 },
  });
}

async function createPersonalProfile(tenantId: string, cpfCnpj: string | null) {
  await prisma.personalProfile.create({
    data: { tenantId, phone: "(11) 91234-5678", cpfCnpj, studentRangeEstimate: "ATE_20", termsAcceptedAt: new Date() },
  });
}

async function createIndividualProfile(tenantId: string, cpfCnpj: string | null) {
  await prisma.individualProfile.create({
    data: {
      tenantId,
      objective: "GANHAR_MASSA",
      experienceLevel: "INICIANTE",
      weeklyAvailability: "TRES_A_QUATRO_DIAS",
      cpfCnpj,
      termsAcceptedAt: new Date(),
    },
  });
}

async function createLinkedSubscription(
  tenantId: string,
  planId: string,
  overrides: Partial<{ provider: string; externalCustomerId: string | null; externalSubscriptionId: string | null }> = {}
) {
  return prisma.saasSubscription.create({
    data: {
      tenantId,
      planId,
      status: "ATIVA",
      provider: overrides.provider ?? ASAAS_PROVIDER,
      externalCustomerId: "externalCustomerId" in overrides ? overrides.externalCustomerId : "cus_1",
      externalSubscriptionId: "externalSubscriptionId" in overrides ? overrides.externalSubscriptionId : "sub_1",
    },
  });
}

describe("attachCreditCardToSubscription (FIT-128, checkout embutido)", () => {
  it("lança SEM_ASSINATURA quando o tenant nunca contratou nenhum plano", async () => {
    const { tenant } = await createTenant("sem-assinatura");
    await createPersonalProfile(tenant.id, "11144477735");

    await expect(
      attachCreditCardToSubscription(
        { tenantId: tenant.id, tenantType: "PERSONAL", ...CARD_FIELDS },
        prisma,
        { apiKey: FAKE_KEY, fetchImpl: createAsaasFetchMock() }
      )
    ).rejects.toMatchObject({ kind: "SEM_ASSINATURA" });
  });

  it("lança SEM_LIGACAO_ASAAS quando a assinatura nunca foi ligada de verdade ao Asaas", async () => {
    const { tenant } = await createTenant("nunca-ligada");
    const plano = await createPlan("nunca-ligada");
    await createPersonalProfile(tenant.id, "11144477735");
    await createLinkedSubscription(tenant.id, plano.id, { provider: NO_PAYMENT_PROVIDER, externalCustomerId: null, externalSubscriptionId: null });

    await expect(
      attachCreditCardToSubscription(
        { tenantId: tenant.id, tenantType: "PERSONAL", ...CARD_FIELDS },
        prisma,
        { apiKey: FAKE_KEY, fetchImpl: createAsaasFetchMock() }
      )
    ).rejects.toMatchObject({ kind: "SEM_LIGACAO_ASAAS" });
  });

  it("lança SEM_LIGACAO_ASAAS quando API_ASAAS não está configurada", async () => {
    const { tenant } = await createTenant("sem-chave");
    const plano = await createPlan("sem-chave");
    await createPersonalProfile(tenant.id, "11144477735");
    await createLinkedSubscription(tenant.id, plano.id);

    await expect(
      attachCreditCardToSubscription({ tenantId: tenant.id, tenantType: "PERSONAL", ...CARD_FIELDS }, prisma, {
        apiKey: undefined,
        fetchImpl: createAsaasFetchMock(),
      })
    ).rejects.toMatchObject({ kind: "SEM_LIGACAO_ASAAS" });
  });

  it("lança SEM_LIGACAO_ASAAS quando o tenant ainda não informou CPF/CNPJ", async () => {
    const { tenant } = await createTenant("sem-cpf");
    const plano = await createPlan("sem-cpf");
    await createPersonalProfile(tenant.id, null);
    await createLinkedSubscription(tenant.id, plano.id);

    await expect(
      attachCreditCardToSubscription(
        { tenantId: tenant.id, tenantType: "PERSONAL", ...CARD_FIELDS },
        prisma,
        { apiKey: FAKE_KEY, fetchImpl: createAsaasFetchMock() }
      )
    ).rejects.toMatchObject({ kind: "SEM_LIGACAO_ASAAS" });
  });

  it("tokeniza o cartão, vincula à assinatura (billingType CREDIT_CARD) e grava só os dados mascarados", async () => {
    const { tenant } = await createTenant("sucesso");
    const plano = await createPlan("sucesso");
    await createPersonalProfile(tenant.id, "11144477735");
    await createLinkedSubscription(tenant.id, plano.id);
    const fetchImpl = createAsaasFetchMock();

    const result = await attachCreditCardToSubscription(
      { tenantId: tenant.id, tenantType: "PERSONAL", ...CARD_FIELDS },
      prisma,
      { apiKey: FAKE_KEY, fetchImpl }
    );

    expect(result).toEqual({ creditCardLast4: "1111", creditCardBrand: "VISA" });

    const tokenizeCall = fetchImpl.mock.calls.find(([url]) => String(url).endsWith("/creditCard/tokenize"));
    expect(tokenizeCall).toBeDefined();
    const tokenizeBody = JSON.parse(String(tokenizeCall?.[1]?.body));
    expect(tokenizeBody.creditCard.number).toBe(CARD_FIELDS.cardNumber);
    expect(tokenizeBody.creditCardHolderInfo.cpfCnpj).toBe("11144477735");
    expect(tokenizeBody.creditCardHolderInfo.name).toBe(tenant.name);

    const updateCall = fetchImpl.mock.calls.find(([url]) => String(url).includes("/subscriptions/"));
    expect(updateCall).toBeDefined();
    expect(JSON.parse(String(updateCall?.[1]?.body))).toEqual({ billingType: "CREDIT_CARD", creditCardToken: "tok_1" });

    const updated = await prisma.saasSubscription.findUnique({ where: { tenantId: tenant.id } });
    expect(updated?.creditCardLast4).toBe("1111");
    expect(updated?.creditCardBrand).toBe("VISA");
  });

  it("funciona também para tenant INDIVIDUAL (FitOS Livre)", async () => {
    const { tenant } = await createTenant("individual-sucesso", "INDIVIDUAL");
    const plano = await createPlan("individual-sucesso");
    await createIndividualProfile(tenant.id, "11144477735");
    await createLinkedSubscription(tenant.id, plano.id);

    const result = await attachCreditCardToSubscription(
      { tenantId: tenant.id, tenantType: "INDIVIDUAL", ...CARD_FIELDS },
      prisma,
      { apiKey: FAKE_KEY, fetchImpl: createAsaasFetchMock() }
    );

    expect(result).toEqual({ creditCardLast4: "1111", creditCardBrand: "VISA" });
  });

  it("cartão recusado pelo Asaas lança CARTAO_RECUSADO com a mensagem saneada, sem gravar nada", async () => {
    const { tenant } = await createTenant("recusado");
    const plano = await createPlan("recusado");
    await createPersonalProfile(tenant.id, "11144477735");
    await createLinkedSubscription(tenant.id, plano.id);

    const fetchImpl = createAsaasFetchMock({
      tokenize: () => jsonResponse(400, { errors: [{ code: "invalid_creditCard", description: "Cartão de crédito inválido." }] }),
    });

    await expect(
      attachCreditCardToSubscription({ tenantId: tenant.id, tenantType: "PERSONAL", ...CARD_FIELDS }, prisma, { apiKey: FAKE_KEY, fetchImpl })
    ).rejects.toMatchObject({ kind: "CARTAO_RECUSADO", message: "Cartão de crédito inválido." });

    const unchanged = await prisma.saasSubscription.findUnique({ where: { tenantId: tenant.id } });
    expect(unchanged?.creditCardLast4).toBeNull();
  });

  it("falha de rede ao tokenizar lança CARTAO_RECUSADO com mensagem genérica, sem gravar nada", async () => {
    const { tenant } = await createTenant("rede");
    const plano = await createPlan("rede");
    await createPersonalProfile(tenant.id, "11144477735");
    await createLinkedSubscription(tenant.id, plano.id);

    const fetchImpl = vi.fn().mockRejectedValue(new Error("ECONNRESET"));

    await expect(
      attachCreditCardToSubscription({ tenantId: tenant.id, tenantType: "PERSONAL", ...CARD_FIELDS }, prisma, { apiKey: FAKE_KEY, fetchImpl })
    ).rejects.toMatchObject({ kind: "CARTAO_RECUSADO" });

    const unchanged = await prisma.saasSubscription.findUnique({ where: { tenantId: tenant.id } });
    expect(unchanged?.creditCardLast4).toBeNull();
  });
});
