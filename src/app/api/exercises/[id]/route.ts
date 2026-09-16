import { authErrorResponse, requirePersonal } from "@/modules/tenancy/authContext";
import { ExerciseError, updateOwnExercise } from "@/modules/exercises/exercises";

/// Edita um exercício próprio do tenant do personal autenticado. Ignora
/// deliberadamente qualquer `tenantId`/`origin` no corpo — `updateOwnExercise`
/// não tem esses parâmetros; o `id` vem da própria URL, mas a busca dentro
/// de `updateOwnExercise` sempre exige `tenantId` da sessão e
/// `origin: "PERSONAL"` também, então um `id` de outro tenant ou de um
/// exercício global nunca é encontrado (nem revelado).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requirePersonal();
    const { id } = await params;
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return Response.json({ error: "VALIDACAO", message: "Corpo da requisição inválido." }, { status: 400 });
    }

    const exercise = await updateOwnExercise({
      tenantId: ctx.tenantId,
      exerciseId: id,
      actorUserId: ctx.userId,
      name: typeof body.name === "string" ? body.name : undefined,
      type: typeof body.type === "string" ? body.type : undefined,
      muscle: typeof body.muscle === "string" ? body.muscle : undefined,
      equipments: typeof body.equipments === "string" ? body.equipments : undefined,
      instructions: typeof body.instructions === "string" ? body.instructions : undefined,
    });

    return Response.json(exercise);
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    if (error instanceof ExerciseError) {
      const status = error.kind === "NAO_ENCONTRADO" ? 404 : 400;
      return Response.json({ error: error.kind, message: error.message }, { status });
    }
    throw error;
  }
}
