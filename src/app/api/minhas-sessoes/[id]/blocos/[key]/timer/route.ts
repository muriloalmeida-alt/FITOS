import { blockTimerHandler } from "../../../../../_execution/handlers";
import { individualExecutor } from "../../../../../_execution/individualExecutor";

/// Timer do bloco do FitOS Livre (iniciar, pausar, retomar).
export async function POST(request: Request, { params }: { params: Promise<{ id: string; key: string }> }) {
  const { id, key } = await params;
  return blockTimerHandler(individualExecutor, request, id, key);
}
