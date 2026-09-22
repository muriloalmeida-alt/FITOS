import type { PersonalStudentRangeEstimate } from "@prisma/client";
import { authErrorResponse, requirePersonal } from "@/modules/tenancy/authContext";
import { completePersonalOnboarding, getPersonalOnboardingProfile, OnboardingError } from "@/modules/personal-onboarding/onboarding";
import { listStudents } from "@/modules/students/students";

const VALID_STUDENT_RANGES: PersonalStudentRangeEstimate[] = ["COMECANDO_AGORA", "ATE_20", "DE_21_A_50", "MAIS_DE_50"];

/// Estado atual do onboarding profissional do Personal autenticado
/// (FIT-113). Mesmo padrão de `/api/onboarding` (FIT-101).
export async function GET() {
  try {
    const ctx = await requirePersonal();
    const profile = await getPersonalOnboardingProfile(ctx.tenantId);
    return Response.json({ completed: profile !== null });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

/// Conclui (ou reabre) o onboarding profissional do Personal autenticado.
/// `redirectTo` no corpo da resposta é o "primeiro passo útil" da seção 7
/// do pacote: cadastrar o primeiro aluno quando o tenant ainda não tem
/// nenhum, senão o painel — decidido no servidor a partir do catálogo real
/// de alunos, nunca um valor fixo.
export async function POST(request: Request) {
  try {
    const ctx = await requirePersonal();
    const body = await request.json().catch(() => null);

    if (
      !body ||
      typeof body.phone !== "string" ||
      !VALID_STUDENT_RANGES.includes(body.studentRangeEstimate) ||
      typeof body.businessName !== "string" ||
      typeof body.termsAccepted !== "boolean"
    ) {
      return Response.json(
        { error: "VALIDACAO", message: "Informe celular, faixa de alunos, nome do espaço e o aceite dos termos." },
        { status: 400 }
      );
    }

    await completePersonalOnboarding({
      tenantId: ctx.tenantId,
      phone: body.phone,
      cref: typeof body.cref === "string" ? body.cref : undefined,
      studentRangeEstimate: body.studentRangeEstimate,
      businessName: body.businessName,
      termsAccepted: body.termsAccepted,
    });

    const students = await listStudents({ tenantId: ctx.tenantId, pageSize: 1 });
    const redirectTo = students.total === 0 ? "/painel/alunos/novo" : "/painel";
    return Response.json({ redirectTo }, { status: 201 });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    if (error instanceof OnboardingError) {
      return Response.json({ error: error.kind, message: error.message }, { status: 400 });
    }
    throw error;
  }
}
