/// Chamada JSON às rotas do painel, com a mensagem de erro do servidor
/// (sempre texto funcional) quando a resposta não é 2xx.
export async function requestJson<T = unknown>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init.headers ?? {}) } });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? "Não foi possível concluir. Tente novamente.");
  }
  return (response.status === 204 ? null : await response.json().catch(() => null)) as T;
}
