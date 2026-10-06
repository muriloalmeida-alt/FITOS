import { requireStudent } from "@/modules/tenancy/authContext";
import { studentCancel } from "@/modules/schedule/schedule";
import { scheduleErrorResponse } from "@/modules/schedule/scheduleErrors";

/// O aluno avisa que não vai à aula (EPIC-48): `{ ref, reason? }`.
export async function POST(request: Request) {
  try {
    const ctx = await requireStudent();
    const body = (await request.json().catch(() => null)) ?? {};
    await studentCancel({ tenantId: ctx.tenantId, studentId: ctx.studentId, userId: ctx.userId, ref: body.ref, reason: body.reason });
    return Response.json({ ok: true });
  } catch (error) {
    return scheduleErrorResponse(error);
  }
}
