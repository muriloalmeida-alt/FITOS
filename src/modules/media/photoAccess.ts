import "server-only";
import { AuthError, authErrorResponse, requireSession } from "@/modules/tenancy/authContext";
import { requireSelfStudent } from "@/modules/tenancy/selfStudent";
import { PhotoError, type PhotoViewer } from "./photos";

/// De quem são as fotos desta requisição (EPIC-35): o personal escolhe o
/// aluno (sempre dentro do próprio tenant); aluno e Livre só falam de si,
/// nunca com um `studentId` vindo do cliente.
export async function resolvePhotoTarget(studentIdFromClient: string | null): Promise<{ userId: string; tenantId: string; studentId: string }> {
  const ctx = await requireSession();
  if (ctx.role === "PERSONAL") {
    if (!studentIdFromClient) throw new AuthError("FORBIDDEN", "Informe o aluno.");
    return { userId: ctx.userId, tenantId: ctx.tenantId, studentId: studentIdFromClient };
  }
  const self = await requireSelfStudent();
  return { userId: self.userId, tenantId: self.tenantId, studentId: self.studentId };
}

export async function resolvePhotoViewer(): Promise<PhotoViewer> {
  const ctx = await requireSession();
  if (ctx.role === "PERSONAL" || ctx.role === "INDIVIDUAL") return { role: ctx.role, tenantId: ctx.tenantId };
  if (ctx.role === "ALUNO" && ctx.tenantId && ctx.studentId) return { role: "ALUNO", tenantId: ctx.tenantId, studentId: ctx.studentId };
  throw new AuthError("FORBIDDEN", "Sem acesso a estas fotos.");
}

export function photoErrorResponse(error: unknown): Response | null {
  const auth = authErrorResponse(error);
  if (auth) return auth;
  if (error instanceof PhotoError) {
    const status = error.kind === "NAO_ENCONTRADO" ? 404 : error.kind === "SEM_AUTORIZACAO" ? 409 : 400;
    return Response.json({ error: error.kind, message: error.message }, { status });
  }
  return null;
}
