import { recordSetHandler, removeSetHandler } from "../../../_execution/handlers";
import { individualExecutor } from "../../../_execution/individualExecutor";

/// BK-11 (FIT-158): "Série feita" do FitOS Livre.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return recordSetHandler(individualExecutor, request, (await params).id);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return removeSetHandler(individualExecutor, request, (await params).id);
}
