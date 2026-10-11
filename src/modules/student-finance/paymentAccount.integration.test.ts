// @vitest-environment node
//
// Recebimento pelo app com subconta Asaas criada pelo FitOS (EPIC-38),
// contra PostgreSQL real e um Asaas simulado: ativar, verificação,
// cobrança com 2% para o FitOS, baixa pelo aviso, limpeza e saque.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "@/shared/db/testDatabaseUrl";
import { dropExternalPayment, getPaymentAccountSummary, handlePersonalWebhook, requestChargePayment } from "./paymentAccount";
import { createSubaccount, getBalanceCents, pixKeyType, refreshAccountStatus, withdrawToPix, type SubaccountInput } from "./asaasSubaccount";

const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const CPF = "52998224725";

beforeAll(() => {
  process.env.PAYMENT_KEYS_SECRET ??= "segredo-de-teste-com-tamanho-suficiente-123";
  process.env.API_ASAAS = "$aact_hmlg_chave-principal-do-fitos";
  process.env.ASAAS_WALLET_ID = "wallet-fitos";
  delete process.env.ASAAS_BASE_URL;
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

function fakeAsaas(state: { general?: string; balance?: number } = {}) {
  const calls: Call[] = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({ method, url, body, key: (init?.headers as Record<string, string>)?.access_token ?? null });
    const json = (status: number, data: unknown) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
    if (url.endsWith("/accounts") && method === "POST") return json(200, { id: `acc_${run}`, apiKey: `$aact_hmlg_sub_${calls.length}`, walletId: `wallet-personal-${calls.length}` });
    if (url.endsWith("/myAccount/status")) return json(200, { general: state.general ?? "AWAITING_APPROVAL" });
    if (url.endsWith("/myAccount/documents")) return json(200, { data: [{ status: "NOT_SENT", onboardingUrl: "https://www.asaas.com/onboarding/abc" }] });
    if (url.endsWith("/finance/balance")) return json(200, { balance: state.balance ?? 0 });
    if (url.includes("/customers?")) return json(200, { object: "list", data: [] });
    if (url.endsWith("/customers")) return json(200, { id: "cus_1" });
    if (url.endsWith("/payments") && method === "POST") {
      const id = `pay_${run}_${calls.length}_${Math.random().toString(36).slice(2, 8)}`;
      return json(200, { id, invoiceUrl: `https://www.asaas.com/i/${id}` });
    }
    if (url.includes("/pixQrCode")) return json(200, { payload: "00020126PIXCOPIAECOLA" });
    if (url.endsWith("/transfers")) return json(200, { id: "tra_1" });
    if (method === "DELETE") return json(200, { deleted: true });
    return json(404, {});
  }) as typeof fetch;
  return { calls, fetchImpl };
}

async function personal(label: string) {
  const owner = await prisma.user.create({ data: { email: `dono-${label}-${run}@example.test`, name: "Murilo Almeida", role: "PERSONAL" } });
  const tenant = await prisma.tenant.create({ data: { ownerId: owner.id, name: `Studio ${label} ${run}` } });
  const student = await prisma.student.create({ data: { tenantId: tenant.id, email: `ana-${label}-${run}@example.test`, displayName: "Ana Costa" } });
  const charge = await prisma.studentCharge.create({ data: { tenantId: tenant.id, studentId: student.id, description: "Mensalidade outubro", amountCents: 15000, referenceMonth: new Date("2026-10-01T00:00:00Z"), dueDate: new Date("2026-10-10T15:00:00Z") } });
  return { owner, tenant, student, charge };
}

const form = (tenantId: string, over: Partial<SubaccountInput> = {}): SubaccountInput => ({
  tenantId,
  name: "Murilo Almeida",
  email: "murilo@example.test",
  cpfCnpj: CPF,
  birthDate: "1990-05-20",
  mobilePhone: "(11) 98765-4321",
  postalCode: "01310-100",
  address: "Av. Paulista",
  addressNumber: "1000",
  province: "Bela Vista",
  incomeValue: 5000,
  payoutPixKey: "murilo@example.test",
  appUrl: "https://fitos.test/",
  ...over,
});

describe("recebimento por subconta Asaas (EPIC-38)", () => {
  it("chave Pix pelo formato", () => {
    expect(pixKeyType("529.982.247-25")).toBe("CPF");
    expect(pixKeyType("a@b.co")).toBe("EMAIL");
    expect(pixKeyType("(11) 98765-4321")).toBe("PHONE");
    expect(pixKeyType("123e4567-e89b-12d3-a456-426614174000")).toBe("EVP");
    expect(pixKeyType("abc")).toBeNull();
  });

  it("valida o cadastro antes de falar com o Asaas", async () => {
    const { tenant } = await personal("valida");
    const asaas = fakeAsaas();
    await expect(createSubaccount(form(tenant.id, { cpfCnpj: "111.111.111-11" }), prisma, asaas)).rejects.toThrow("CPF ou CNPJ inválido.");
    await expect(createSubaccount(form(tenant.id, { birthDate: null }), prisma, asaas)).rejects.toThrow("Informe sua data de nascimento.");
    await expect(createSubaccount(form(tenant.id, { payoutPixKey: "abc" }), prisma, asaas)).rejects.toThrow("Chave Pix inválida.");
    expect(asaas.calls).toHaveLength(0);
  });

  it("ativa sem o personal entrar no Asaas, cobra com 2% para o FitOS e dá baixa", async () => {
    const { tenant, charge } = await personal("fluxo");
    const asaas = fakeAsaas();
    expect(await createSubaccount(form(tenant.id), prisma, asaas)).toEqual({ status: "PENDENTE", onboardingUrl: "https://www.asaas.com/onboarding/abc" });

    const created = asaas.calls.find((call) => call.url.endsWith("/accounts"))!;
    expect(created.url.startsWith("https://api-sandbox.asaas.com/v3")).toBe(true);
    expect(created.key).toBe("$aact_hmlg_chave-principal-do-fitos");
    const account = await prisma.paymentAccount.findUniqueOrThrow({ where: { tenantId: tenant.id } });
    expect(created.body).toMatchObject({ cpfCnpj: CPF, birthDate: "1990-05-20", mobilePhone: "11987654321", postalCode: "01310100", incomeValue: 5000 });
    expect((created.body!.webhooks as Record<string, unknown>[])[0]).toMatchObject({ url: `https://fitos.test/api/webhooks/asaas-personal/${account.webhookToken}`, authToken: account.webhookSecret });
    expect(account).toMatchObject({ provider: "asaas_subconta", environment: "sandbox", status: "PENDENTE", payoutPixKey: "murilo@example.test", payoutPixKeyType: "EMAIL" });
    expect(account.apiKeyEncrypted).not.toContain("aact");
    expect(await getPaymentAccountSummary(tenant.id, prisma)).toMatchObject({ status: "PENDENTE", onboardingUrl: "https://www.asaas.com/onboarding/abc" });

    // A cobrança sai pela subconta, com 2% para a carteira do FitOS.
    await requestChargePayment({ tenantId: tenant.id, chargeId: charge.id, studentCpf: CPF, now: new Date("2026-10-05T12:00:00Z") }, prisma, asaas);
    const payment = asaas.calls.find((call) => call.url.endsWith("/payments"))!;
    expect(payment.key).toMatch(/^\$aact_hmlg_sub_/);
    expect(payment.body).toMatchObject({ value: 150, split: [{ walletId: "wallet-fitos", percentualValue: 2 }] });

    const saved = await prisma.studentCharge.findUniqueOrThrow({ where: { id: charge.id } });
    const event = { event: "PAYMENT_RECEIVED", payment: { id: saved.externalPaymentId, value: 150, billingType: "PIX", paymentDate: "2026-10-06" } };
    expect(await handlePersonalWebhook({ token: account.webhookToken, headerToken: account.webhookSecret, body: event }, prisma)).toEqual({ status: 200, result: "baixa" });
    expect((await prisma.studentCharge.findUniqueOrThrow({ where: { id: charge.id }, include: { payment: true } })).payment).toMatchObject({ amountCentsPaid: 15000, method: "Pix" });

    // Aprovação chega pelo aviso do Asaas.
    expect(await handlePersonalWebhook({ token: account.webhookToken, headerToken: account.webhookSecret, body: { event: "ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED" } }, prisma)).toEqual({ status: 200, result: "status_conta" });
    expect((await getPaymentAccountSummary(tenant.id, prisma)).status).toBe("APROVADA");
  });

  it("saque por Pix só com a conta aprovada", async () => {
    const { tenant } = await personal("saque");
    const asaas = fakeAsaas({ balance: 285.5 });
    await createSubaccount(form(tenant.id, { payoutPixKey: "529.982.247-25" }), prisma, asaas);
    expect(await getBalanceCents(tenant.id, prisma, asaas)).toBe(28550);
    await expect(withdrawToPix({ tenantId: tenant.id, amountCents: 28550 }, prisma, asaas)).rejects.toThrow("O saque libera quando o Asaas aprovar sua conta.");

    const approved = fakeAsaas({ general: "APPROVED", balance: 285.5 });
    expect((await refreshAccountStatus({ tenantId: tenant.id, force: true }, prisma, approved)).status).toBe("APROVADA");
    await withdrawToPix({ tenantId: tenant.id, amountCents: 28550 }, prisma, approved);
    expect(approved.calls.find((call) => call.url.endsWith("/transfers"))!.body).toMatchObject({ value: 285.5, operationType: "PIX", pixAddressKey: CPF, pixAddressKeyType: "CPF" });
  });

  it("recebido à mão: a cobrança no Asaas sai", async () => {
    const { tenant, charge } = await personal("manual");
    const asaas = fakeAsaas();
    await createSubaccount(form(tenant.id), prisma, asaas);
    await requestChargePayment({ tenantId: tenant.id, chargeId: charge.id, studentCpf: CPF }, prisma, asaas);
    const { externalPaymentId } = await prisma.studentCharge.findUniqueOrThrow({ where: { id: charge.id } });
    await dropExternalPayment({ tenantId: tenant.id, chargeId: charge.id }, prisma, asaas);
    expect(asaas.calls.some((call) => call.method === "DELETE" && call.url.endsWith(`/payments/${externalPaymentId}`))).toBe(true);
  });
});
