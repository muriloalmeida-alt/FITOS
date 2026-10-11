import { authErrorResponse, requireStudent } from "@/modules/tenancy/authContext";
import { getStudentHome } from "@/modules/students/studentHome";

/// O que o aluno tem para hoje (EPIC-33): usado no fim da entrada pelo
/// convite para mostrar "Seu treino de hoje" sem sair da tela.
export async function GET() {
  try {
    const ctx = await requireStudent();
    const home = await getStudentHome({ tenantId: ctx.tenantId, studentId: ctx.studentId });
    return Response.json({ hero: home.hero, program: home.program });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
