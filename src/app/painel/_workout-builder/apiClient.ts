/// Erro de uma rota do painel: `message` é sempre texto funcional (vem do
/// servidor) e `kind` é o código (ex.: "LIMITE_DE_ALUNOS_ATINGIDO").
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly kind: string | null,
    public readonly status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/// Chamada JSON às rotas do painel, com a mensagem de erro do servidor
/// quando a resposta não é 2xx.
export async function requestJson<T = unknown>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init.headers ?? {}) } });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string; error?: string } | null;
    throw new ApiError(body?.message ?? "Não foi possível concluir. Tente novamente.", body?.error ?? null, response.status);
  }
  return (response.status === 204 ? null : await response.json().catch(() => null)) as T;
}
