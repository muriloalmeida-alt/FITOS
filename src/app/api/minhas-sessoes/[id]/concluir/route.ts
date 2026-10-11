import { completeHandler } from "../../../_execution/handlers";
import { individualExecutor } from "../../../_execution/individualExecutor";

/// Conclui a sessão do próprio praticante (FIT-103). FIT-158: tempo ativo
/// (BK-14) e resumo do treino.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return completeHandler(individualExecutor, request, (await params).id);
}
