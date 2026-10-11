import { ApiError } from "../_workout-builder/apiClient";

/// Envio `multipart/form-data` às rotas de foto (EPIC-35), com a mensagem
/// do servidor quando falha.
export async function uploadForm<T = unknown>(url: string, form: FormData): Promise<T> {
  const response = await fetch(url, { method: "POST", body: form });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string; error?: string } | null;
    throw new ApiError(body?.message ?? "Não foi possível enviar a foto. Tente novamente.", body?.error ?? null, response.status);
  }
  return (await response.json().catch(() => null)) as T;
}
