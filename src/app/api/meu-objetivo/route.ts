import { authErrorResponse, requireStudent } from "@/modules/tenancy/authContext";
import { prisma } from "@/shared/db/prisma";
import { STUDENT_OBJECTIVES } from "@/shared/lib/studentObjectives";

/// Objetivo que o aluno escolhe ao entrar pelo convite (EPIC-33). O
/// personal vê no perfil do aluno.
export async function PATCH(request: Request) {
  try {
    const ctx = await requireStudent();
    const body = await request.json().catch(() => null);
    if (!STUDENT_OBJECTIVES.includes(body?.objective)) {
      return Response.json({ error: "VALIDACAO", message: "Escolha um objetivo." }, { status: 400 });
    }
    await prisma.student.update({ where: { id: ctx.studentId }, data: { objective: body.objective } });
    return Response.json({ objective: body.objective });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
