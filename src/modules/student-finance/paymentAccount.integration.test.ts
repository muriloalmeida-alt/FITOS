// @vitest-environment node
//
// Cobrança do aluno pela conta Asaas do personal (EPIC-38) contra
// PostgreSQL real, com um Asaas falso: conectar, gerar a cobrança, baixa
// pelo aviso de pagamento e limpeza ao receber à mão.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { connectPaymentAccount, dropExternalPayment, environmentOf, getPaymentAccountSummary, handlePersonalWebhook, requestChargePayment } from "./paymentAccount";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const CPF = "52998224725";

beforeAll(() => {
  process.env.PAYMENT_KEYS_SECRET ??= "segredo-de-teste-com-tamanho-suficiente-123";
});

afterAll(async () => {
  const where = { tenant: { name: { contains: run } } };
  await prisma.payment.deleteMany({ where });
  await prisma.auditEvent.deleteMany({ where });
  await prisma.studentCharge.deleteMany({ where });
  await prisma.student.deleteMany({ where });
  await prisma.tenant.deleteMany({ where: { name: { contains: run } } });
  await prisma.user.deleteMany({ where: { email: { contains: run } } });
  await prisma.$disconnect();
});

type Call = { method: string; url: string; body: Record<string, unknown> | null; key: string | null };

function fakeAsaas(options: { rejectKey?: boolean } = {}) {
  const calls: Call[] = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({ method, url, body, key: (init?.headers as Record<string, string>)?.access_token ?? null });
    const json = (status: number, data: unknown) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
    if (options.rejectKey) return json(401, { errors: [{ code: "invalid_access_token", description: "Chave inválida" }] });
    if (url.includes("/customers?")) return json(200, { object: "list", data: [] });
    if (url.endsWith("/customers")) return json(200, { id: "cus_1" });
    if (url.endsWith("/webhooks")) return json(200, { id: "wh_1" });
    if (url.endsWith("/payments") && method === "POST") { const id = `pay_${run}_${calls.length}_${Math.random().toString(36).slice(2, 8)}`; return json(200, { id, invoiceUrl: `https://www.asaas.com/i/${id}` }); }
    if (url.includes("/pixQrCode")) return json(200, { payload: "00020126PIXCOPIAECOLA" });
    if (method === "DELETE") return json(200, { deleted: true });
    return json(404, {});
  }) as typeof fetch;
  return { calls, fetchImpl };
}

async function personal(label: string) {
  const owner = await prisma.user.create({ data: { email: `dono-${label}-${run}@example.test`, name: "Murilo", role: "PERSONAL" } });
  const tenant = await prisma.tenant.create({ data: { ownerId: owner.id, name: `Studio ${label} ${run}` } });
  const student = await prisma.student.create({ data: { tenantId: tenant.id, email: `ana-${label}-${run}@example.test`, displayName: "Ana Costa" } });
  const charge = await prisma.studentCharge.create({ data: { tenantId: tenant.id, studentId: student.id, description: "Mensalidade outubro", amountCents: 15000, referenceMonth: new Date("2026-10-01T00:00:00Z"), dueDate: new Date("2026-10-10T15:00:00Z") } });
  return { owner, tenant, student, charge };
}

const KEY = "$aact_hmlg_000MzkwODA2MWY2OGM3MWRlNTZlMTk4MGE3ZjA5ZDZhOjo";

describe("conta Asaas do personal (EPIC-38)", () => {
  it("ambiente pela chave", () => {
    expect(environmentOf(KEY)).toBe("sandbox");
    expect(environmentOf("$aact_prod_000abc")).toBe("producao");
  });

  it("recusa chave inválida sem guardar nada", async () => {
    const { tenant } = await personal("chave-ruim");
    const asaas = fakeAsaas({ rejectKey: true });
    await expect(connectPaymentAccount({ tenantId: tenant.id, apiKey: KEY, appUrl: "https://fitos.test", ownerEmail: "m@t.test" }, prisma, asaas)).rejects.toThrow("A chave de API não foi aceita pelo Asaas");
    expect((await getPaymentAccountSummary(tenant.id, prisma)).connected).toBe(false);
  });

  it("conecta, cadastra o aviso, cobra o aluno e dá baixa quando ele paga", async () => {
    const { tenant, charge, student } = await personal("fluxo");
    const asaas = fakeAsaas();
    expect(await connectPaymentAccount({ tenantId: tenant.id, apiKey: KEY, appUrl: "https://fitos.test/", ownerEmail: "m@t.test" }, prisma, asaas)).toEqual({ connected: true, environment: "sandbox", automatic: true });
    const account = await prisma.paymentAccount.findUniqueOrThrow({ where: { tenantId: tenant.id } });
    expect(account.apiKeyEncrypted).not.toContain("aact");
    const hook = asaas.calls.find((call) => call.url.endsWith("/webhooks"))!;
    expect(hook.url.startsWith("https://api-sandbox.asaas.com/v3")).toBe(true);
    expect(hook.body).toMatchObject({ url: `https://fitos.test/api/webhooks/asaas-personal/${account.webhookToken}`, authToken: account.webhookSecret, events: ["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED", "PAYMENT_DELETED"] });

    await expect(requestChargePayment({ tenantId: tenant.id, chargeId: charge.id }, prisma, asaas)).rejects.toThrow("Informe o CPF do aluno");
    await expect(requestChargePayment({ tenantId: tenant.id, chargeId: charge.id, studentCpf: "111.111.111-11" }, prisma, asaas)).rejects.toThrow("CPF do aluno inválido.");
    const link = await requestChargePayment({ tenantId: tenant.id, chargeId: charge.id, studentCpf: "529.982.247-25", now: new Date("2026-10-05T12:00:00Z") }, prisma, asaas);
    expect(link.pixPayload).toBe("00020126PIXCOPIAECOLA");
    expect(link.paymentUrl).toMatch(/^https:\/\/www\.asaas\.com\/i\//);
    expect(asaas.calls.find((call) => call.url.endsWith("/customers"))!.body).toMatchObject({ name: "Ana Costa", cpfCnpj: CPF });
    expect(asaas.calls.find((call) => call.url.endsWith("/payments"))!.body).toMatchObject({ customer: "cus_1", billingType: "UNDEFINED", value: 150, dueDate: "2026-10-10", externalReference: charge.id });
    expect((await prisma.student.findUniqueOrThrow({ where: { id: student.id } })).cpf).toBe(CPF);

    // Segunda vez devolve o mesmo link, sem criar outra cobrança.
    const before = asaas.calls.filter((call) => call.url.endsWith("/payments")).length;
    expect((await requestChargePayment({ tenantId: tenant.id, chargeId: charge.id }, prisma, asaas)).paymentUrl).toBe(link.paymentUrl);
    expect(asaas.calls.filter((call) => call.url.endsWith("/payments")).length).toBe(before);

    const saved = await prisma.studentCharge.findUniqueOrThrow({ where: { id: charge.id } });
    const event = { event: "PAYMENT_RECEIVED", payment: { id: saved.externalPaymentId, value: 150, billingType: "PIX", paymentDate: "2026-10-06" } };
    expect(await handlePersonalWebhook({ token: account.webhookToken, headerToken: "errado", body: event }, prisma)).toEqual({ status: 401, result: "nao_autorizado" });
    expect(await handlePersonalWebhook({ token: account.webhookToken, headerToken: account.webhookSecret, body: event }, prisma)).toEqual({ status: 200, result: "baixa" });
    expect(await handlePersonalWebhook({ token: account.webhookToken, headerToken: account.webhookSecret, body: { ...event, event: "PAYMENT_CONFIRMED" } }, prisma)).toEqual({ status: 200, result: "ja_paga" });
    const paid = await prisma.studentCharge.findUniqueOrThrow({ where: { id: charge.id }, include: { payment: true } });
    expect(paid.status).toBe("PAGO");
    expect(paid.payment).toMatchObject({ amountCentsPaid: 15000, method: "Pix" });
  });

  it("recebido à mão: a cobrança no Asaas sai", async () => {
    const { tenant, charge } = await personal("manual");
    const asaas = fakeAsaas();
    await connectPaymentAccount({ tenantId: tenant.id, apiKey: KEY, appUrl: "https://fitos.test", ownerEmail: "m@t.test" }, prisma, asaas);
    await requestChargePayment({ tenantId: tenant.id, chargeId: charge.id, studentCpf: CPF }, prisma, asaas);
    const { externalPaymentId } = await prisma.studentCharge.findUniqueOrThrow({ where: { id: charge.id } });
    await dropExternalPayment({ tenantId: tenant.id, chargeId: charge.id }, prisma, asaas);
    expect(asaas.calls.some((call) => call.method === "DELETE" && call.url.endsWith(`/payments/${externalPaymentId}`))).toBe(true);
    expect(await prisma.studentCharge.findUniqueOrThrow({ where: { id: charge.id } })).toMatchObject({ externalPaymentId: null, paymentUrl: null });
  });
});
