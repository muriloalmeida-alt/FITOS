import "server-only";
import { Prisma, type PrismaClient, type Student } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";

interface IndividualTenant {
  id: string;
  ownerId: string;
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/// Garante que o tenant `INDIVIDUAL` informado tenha um `Student` que
/// referencia o próprio dono (auto-referência: `Student.userId ===
/// Tenant.ownerId`) — necessário porque `WorkoutSession`/`PlanAssignment`
/// exigem `studentId` (FK obrigatória) e o praticante sem personal não
/// tem nenhum aluno real. Decisão adiada pela `ADR-006-WORKSPACE-
/// INDIVIDUAL.md` (FIT-100), resolvida na FIT-103 quando `WorkoutSession`
/// se tornou a primeira necessidade concreta dessa FK.
///
/// Mesma idempotência/concorrência de `ensureTenantForPersonal`/
/// `ensureTenantForIndividual`: a constraint física `students.userId
/// @unique` decide a corrida real; a chamada perdedora só busca e
/// retorna o `Student` que a vencedora criou. Chamado sob demanda (no
/// início de uma sessão de execução), nunca no cadastro — nenhuma rota
/// hoje precisa do `Student` antes de o praticante realmente começar um
/// treino.
export async function ensureStudentForIndividual(tenant: IndividualTenant, client: PrismaClient = prisma): Promise<Student> {
  const existing = await client.student.findUnique({ where: { userId: tenant.ownerId } });
  if (existing) {
    return existing;
  }

  const owner = await client.user.findUniqueOrThrow({ where: { id: tenant.ownerId } });

  try {
    return await client.student.create({
      data: { tenantId: tenant.id, userId: tenant.ownerId, email: owner.email, displayName: owner.name },
    });
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      return client.student.findUniqueOrThrow({ where: { userId: tenant.ownerId } });
    }
    throw error;
  }
}
