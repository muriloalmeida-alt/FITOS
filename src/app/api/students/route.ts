import type { StudentStatus } from "@prisma/client";
import { authErrorResponse, requirePersonal } from "@/modules/tenancy/authContext";
import { createStudent, listStudents, StudentError, type StudentSortOrder } from "@/modules/students/students";

const VALID_STATUS: StudentStatus[] = ["ATIVO", "INATIVO"];
const VALID_SORT: StudentSortOrder[] = ["nome_asc", "recente"];

/// Lista os alunos do tenant do personal autenticado. Qualquer `tenantId`
/// que um cliente tentasse enviar (não há esse parâmetro aqui) seria
/// ignorado — o único tenant possível é o derivado da sessão.
export async function GET(request: Request) {
  try {
    const ctx = await requirePersonal();
    const url = new URL(request.url);

    const statusParam = url.searchParams.get("status");
    const status = statusParam && VALID_STATUS.includes(statusParam as StudentStatus) ? (statusParam as StudentStatus) : undefined;

    const sortParam = url.searchParams.get("sort");
    const sort = sortParam && VALID_SORT.includes(sortParam as StudentSortOrder) ? (sortParam as StudentSortOrder) : undefined;

    const page = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
    const pageSize = Number.parseInt(url.searchParams.get("pageSize") ?? "20", 10);

    const result = await listStudents({
      tenantId: ctx.tenantId,
      search: url.searchParams.get("q") ?? undefined,
      status,
      sort,
      page: Number.isFinite(page) ? page : undefined,
      pageSize: Number.isFinite(pageSize) ? pageSize : undefined,
    });

    return Response.json(result);
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

/// Cadastra um aluno no tenant do personal autenticado. Ignora
/// deliberadamente qualquer `tenantId` no corpo da requisição — não há
/// esse campo na assinatura de `createStudent`.
export async function POST(request: Request) {
  try {
    const ctx = await requirePersonal();
    const body = await request.json().catch(() => null);

    if (!body || typeof body.name !== "string" || typeof body.email !== "string") {
      return Response.json({ error: "VALIDACAO", message: "Informe nome e e-mail." }, { status: 400 });
    }

    const student = await createStudent({ tenantId: ctx.tenantId, name: body.name, email: body.email });
    return Response.json(student, { status: 201 });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    if (error instanceof StudentError) {
      return Response.json({ error: error.kind, message: error.message }, { status: 400 });
    }
    throw error;
  }
}
