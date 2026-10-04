import { requireIndividual } from "@/modules/tenancy/authContext";
import { ensureStudentForIndividual } from "@/modules/tenancy/ensureStudentForIndividual";

/// Executor das sessões do FitOS Livre: o próprio praticante (Student de
/// auto-referência do tenant individual).
export async function individualExecutor() {
  const ctx = await requireIndividual();
  const student = await ensureStudentForIndividual({ id: ctx.tenantId, ownerId: ctx.userId });
  return { tenantId: ctx.tenantId, studentId: student.id };
}
