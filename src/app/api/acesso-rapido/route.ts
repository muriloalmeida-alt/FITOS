import { prisma } from "@/shared/db/prisma";
import { authErrorResponse, requireSession } from "@/modules/tenancy/authContext";
import { quickActionsFor } from "../../painel/_quick/quickActions";

/// Ações do botão + (proposta 7) para quem está logado.
export async function GET() {
  try {
    const ctx = await requireSession();
    if (ctx.role === "INDIVIDUAL") {
      const tenant = await prisma.tenant.findUnique({ where: { ownerId: ctx.userId }, select: { id: true } });
      return Response.json({ actions: tenant ? await quickActionsFor({ role: "INDIVIDUAL", userId: ctx.userId, tenantId: tenant.id }) : [] });
    }
    if (ctx.role === "ALUNO") return Response.json({ actions: await quickActionsFor({ role: "ALUNO", userId: ctx.userId }) });
    return Response.json({ actions: await quickActionsFor({ role: ctx.role === "PERSONAL" ? "PERSONAL" : "ADMIN" }) });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
