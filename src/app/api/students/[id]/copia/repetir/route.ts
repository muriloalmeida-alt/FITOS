import { requirePersonal } from "@/modules/tenancy/authContext";
import { repeatStudentProgram } from "@/modules/library/studentCopy";
import { workoutErrorResponse } from "../../../../_workoutErrors";

/// Repetir o programa do aluno: novo ciclo a partir de hoje (EPIC-29).
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requirePersonal();
    const { id } = await params;
    return Response.json(await repeatStudentProgram({ tenantId: ctx.tenantId, actorUserId: ctx.userId, studentId: id }), { status: 201 });
  } catch (error) {
    return workoutErrorResponse(error);
  }
}
