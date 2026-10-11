import { rateHandler } from "../../../_execution/handlers";
import { individualExecutor } from "../../../_execution/individualExecutor";

/// BK-13 (FIT-158): esforço percebido no próprio histórico do Livre.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return rateHandler(individualExecutor, request, (await params).id);
}
