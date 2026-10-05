import { requireAdmin } from "@/modules/tenancy/authContext";
import { AdminError, deleteUserByAdmin } from "@/modules/admin/users";
import { prisma } from "@/shared/db/prisma";
import { adminErrorResponse } from "../../_errors";

/// Exclui o usuário e tudo o que é dele. Exige repetir o e-mail do
/// usuário no corpo (`confirmEmail`), a mesma confirmação da tela.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireAdmin();
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const confirmEmail = typeof body?.confirmEmail === "string" ? body.confirmEmail.trim().toLowerCase() : "";
    const target = await prisma.user.findUnique({ where: { id }, select: { email: true } });
    if (!target) throw new AdminError("NAO_ENCONTRADO", "Usuário não encontrado.");
    if (confirmEmail !== target.email.toLowerCase()) {
      throw new AdminError("VALIDACAO", "Digite o e-mail do usuário para confirmar.");
    }
    const deleted = await deleteUserByAdmin({ adminUserId: ctx.userId, userId: id });
    return Response.json(deleted);
  } catch (error) {
    return adminErrorResponse(error);
  }
}
