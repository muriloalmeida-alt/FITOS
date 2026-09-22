/**
 * Máscara e validação de celular brasileiro (FIT-113, seção 7 do pacote:
 * "aplicar máscara e validação brasileiras"). Sempre DDD (2 dígitos) + 9
 * dígitos — o "9" inicial do celular é obrigatório na numeração atual do
 * Brasil; não suporta telefone fixo (8 dígitos) deliberadamente, porque o
 * campo é sempre chamado "celular", nunca "telefone", nos três lugares
 * onde aparece.
 */
const DIGITS_ONLY = /\D/g;

export function formatBrazilianPhone(rawValue: string): string {
  const digits = rawValue.replace(DIGITS_ONLY, "").slice(0, 11);
  if (digits.length === 0) {
    return "";
  }
  if (digits.length <= 2) {
    return `(${digits}`;
  }
  if (digits.length <= 7) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function isValidBrazilianPhone(value: string): boolean {
  const digits = value.replace(DIGITS_ONLY, "");
  return digits.length === 11;
}
