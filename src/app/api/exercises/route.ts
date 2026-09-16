import { authErrorResponse, requirePersonal } from "@/modules/tenancy/authContext";
import { createOwnExercise, ExerciseError } from "@/modules/exercises/exercises";

/// Cadastra um exercício próprio no tenant do personal autenticado. Ignora
/// deliberadamente qualquer `tenantId`/`origin` no corpo da requisição —
/// não há esses campos na assinatura de `createOwnExercise`; o exercício
/// criado é sempre `origin: "PERSONAL"` do tenant da sessão. Aluno nunca
/// chega aqui — `requirePersonal()` rejeita antes de qualquer outra coisa.
export async function POST(request: Request) {
  try {
    const ctx = await requirePersonal();
    const body = await request.json().catch(() => null);

    if (!body || typeof body.name !== "string") {
      return Response.json({ error: "VALIDACAO", message: "Informe o nome do exercício." }, { status: 400 });
    }

    const exercise = await createOwnExercise({
      tenantId: ctx.tenantId,
      actorUserId: ctx.userId,
      name: body.name,
      type: typeof body.type === "string" ? body.type : undefined,
      muscle: typeof body.muscle === "string" ? body.muscle : undefined,
      equipments: typeof body.equipments === "string" ? body.equipments : undefined,
      instructions: typeof body.instructions === "string" ? body.instructions : undefined,
    });
    return Response.json(exercise, { status: 201 });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    if (error instanceof ExerciseError) {
      return Response.json({ error: error.kind, message: error.message }, { status: 400 });
    }
    throw error;
  }
}
