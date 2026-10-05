import { authErrorResponse, requirePersonal } from "@/modules/tenancy/authContext";
import { prisma } from "@/shared/db/prisma";
import { PaymentAccountError, connectPaymentAccount, disconnectPaymentAccount } from "@/modules/student-finance/paymentAccount";

function errorResponse(error: unknown): Response {
  const auth = authErrorResponse(error);
  if (auth) return auth;
  if (error instanceof PaymentAccountError) return Response.json({ error: error.kind, message: error.message }, { status: error.kind === "ASAAS" ? 502 : 400 });
  throw error;
}

/// Conecta a conta Asaas do personal para cobrar os alunos pelo app
/// (EPIC-38): `{ apiKey }`.
export async function PUT(request: Request) {
  try {
    const ctx = await requirePersonal();
    const body = await request.json().catch(() => null);
    const owner = await prisma.user.findUniqueOrThrow({ where: { id: ctx.userId }, select: { email: true } });
    const summary = await connectPaymentAccount({
      tenantId: ctx.tenantId,
      apiKey: typeof body?.apiKey === "string" ? body.apiKey : "",
      appUrl: process.env.BETTER_AUTH_URL ?? new URL(request.url).origin,
      ownerEmail: owner.email,
    });
    return Response.json(summary);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE() {
  try {
    const ctx = await requirePersonal();
    await disconnectPaymentAccount({ tenantId: ctx.tenantId });
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
