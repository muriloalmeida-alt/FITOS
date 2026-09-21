/// Formatação de valores monetários (FIT-050). Os valores em si nunca
/// trafegam como ponto flutuante binário fora da UI (`amountCents` em Int,
/// `REGRAS-DE-NEGOCIO.md` seção 8) — esta função só converte o Int em
/// centavos para o texto exibido, nunca o contrário.
export function formatCentsBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}
