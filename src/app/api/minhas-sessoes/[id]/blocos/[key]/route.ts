import { blockResultHandler } from "../../../../_execution/handlers";
import { individualExecutor } from "../../../../_execution/individualExecutor";

/// Resultado do bloco do FitOS Livre (encerra o bloco; reenviar corrige).
export async function PUT(request: Request, { params }: { params: Promise<{ id: string; key: string }> }) {
  const { id, key } = await params;
  return blockResultHandler(individualExecutor, request, id, key);
}
