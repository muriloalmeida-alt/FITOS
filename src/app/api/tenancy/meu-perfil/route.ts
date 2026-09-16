import { prisma } from "@/shared/db/prisma";
import { authErrorResponse, requireStudent } from "@/modules/tenancy/authContext";

/// Rota de prova mínima da FIT-011: acesso exclusivo do aluno ao próprio
/// perfil de Student. O `studentId` retornado é sempre o derivado da
/// sessão (`requireStudent`) — não existe parâmetro nesta rota que aceite
/// um `studentId` diferente. Não é uma feature de perfil de aluno —
/// apenas a prova de que o isolamento funciona.
export async function GET(_request: Request) {
  // `_request` é recebido e deliberadamente ignorado: nenhum `studentId` de
  // query string, header ou corpo é lido em nenhum ponto deste handler.
  try {
    const ctx = await requireStudent();
    const student = await prisma.student.findUniqueOrThrow({ where: { id: ctx.studentId } });
    return Response.json({ id: student.id, displayName: student.displayName });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) {
      return response;
    }
    throw error;
  }
}
