/**
 * Máscara e validação de cartão de crédito (FIT-128, checkout embutido no
 * FitOS — decisão de Murilo: "toda a transação deve ocorrer no FitOS",
 * nunca um redirecionamento para uma página hospedada pelo Asaas). Mesmo
 * princípio de `cpfCnpj.ts`: validação real (dígito verificador de
 * Luhn), nunca só contagem de dígitos — este valor alimenta diretamente
 * `POST /v3/creditCard/tokenize` no Asaas.
 */
const DIGITS_ONLY = /\D/g;

/// Máscara progressiva em grupos de 4 enquanto o usuário digita — nunca
/// mais de 19 dígitos (o maior número de cartão real em uso).
export function formatCreditCardNumber(rawValue: string): string {
  const digits = rawValue.replace(DIGITS_ONLY, "").slice(0, 19);
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

/// Algoritmo de Luhn — validação real de checksum, nunca só a contagem de
/// dígitos. Rejeita sequências de um único dígito repetido (nunca um
/// cartão real, mesmo que passasse o checksum por coincidência).
export function isValidCreditCardNumber(value: string): boolean {
  const digits = value.replace(DIGITS_ONLY, "");
  if (digits.length < 13 || digits.length > 19) {
    return false;
  }
  if (/^(\d)\1+$/.test(digits)) {
    return false;
  }
  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = Number(digits.charAt(i));
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

/// CVV/CVC — sempre 3 ou 4 dígitos, nunca outro tamanho.
export function isValidCreditCardCcv(value: string): boolean {
  return /^\d{3,4}$/.test(value.replace(DIGITS_ONLY, ""));
}

/// Mês/ano de validade não podem estar no passado — comparação por
/// competência (ano/mês), nunca por dia (um cartão vence no último dia do
/// mês informado, nunca antes).
export function isValidCreditCardExpiry(month: string, year: string, referenceDate: Date = new Date()): boolean {
  const monthNumber = Number(month);
  const yearNumber = Number(year);
  if (!Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    return false;
  }
  if (!Number.isInteger(yearNumber) || String(yearNumber).length !== 4) {
    return false;
  }
  const referenceYear = referenceDate.getFullYear();
  const referenceMonth = referenceDate.getMonth() + 1;
  return yearNumber > referenceYear || (yearNumber === referenceYear && monthNumber >= referenceMonth);
}

/// CEP — máscara `12345-678`, sempre 8 dígitos.
export function formatPostalCode(rawValue: string): string {
  const digits = rawValue.replace(DIGITS_ONLY, "").slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

export function isValidPostalCode(value: string): boolean {
  return value.replace(DIGITS_ONLY, "").length === 8;
}
