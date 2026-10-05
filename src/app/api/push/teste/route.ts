import { authErrorResponse, requireSession } from "@/modules/tenancy/authContext";
import { sendToUser } from "@/modules/notifications/push";

/// Manda uma notificação de teste para os aparelhos da própria pessoa.
export async function POST() {
  try {
    const ctx = await requireSession();
    const delivered = await sendToUser(ctx.userId, { title: "FitOS", body: "Notificações ligadas. É assim que os avisos vão chegar.", url: "/painel/perfil", tag: "teste" });
    if (delivered === 0) {
      return Response.json({ error: "SEM_APARELHO", message: "Nenhum aparelho recebeu. Ative as notificações de novo." }, { status: 409 });
    }
    return Response.json({ delivered });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
