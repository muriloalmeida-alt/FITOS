import { authErrorResponse, requirePersonal } from "@/modules/tenancy/authContext";
import { StudentError, updateStudent } from "@/modules/students/students";

/// Edita nome e/ou e-mail de um aluno do tenant do personal autenticado.
/// Ignora deliberadamente qualquer `tenantId` no corpo — `updateStudent`
/// não tem esse parâmetro; o `studentId` vem da própria URL, mas a busca
/// dentro de `updateStudent` sempre exige `tenantId` da sessão também, então
/// um `id` de outro tenant nunca é encontrado (nem revelado).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requirePersonal();
    const { id } = await params;
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return Response.json({ error: "VALIDACAO", message: "Corpo da requisição inválido." }, { status: 400 });
    }

    const student = await updateStudent({
      tenantId: ctx.tenantId,
      studentId: id,
      actorUserId: ctx.userId,
      name: typeof body.name === "string" ? body.name : undefined,
      email: typeof body.email === "string" ? body.email : undefined,
    });

    return Response.json(student);
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    if (error instanceof StudentError) {
      const status = error.kind === "NAO_ENCONTRADO" ? 404 : 400;
      return Response.json({ error: error.kind, message: error.message }, { status });
    }
    throw error;
  }
}
