/**
 * Máscara e validação de CPF/CNPJ (FIT-128, Issue #153) — dado exigido
 * pelo Asaas em `POST /v3/customers` (`cpfCnpj`) e ausente de todo o
 * onboarding do FitOS até aqui. Um único campo aceita os dois formatos
 * pela quantidade de dígitos: 11 é CPF, 14 é CNPJ — nunca outro tamanho.
 * Validação real por dígito verificador (algoritmo da Receita Federal),
 * não só contagem de dígitos — nunca aceitar 11/14 dígitos quaisquer
 * como se fossem válidos, dado que este valor alimenta diretamente uma
 * chamada real ao Asaas numa História futura.
 */
const DIGITS_ONLY = /\D/g;

function formatCpf(digits: string): string {
  if (digits.length <= 3) {
    return digits;
  }
  if (digits.length <= 6) {
    return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  }
  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

function formatCnpj(digits: string): string {
  if (digits.length <= 2) {
    return digits;
  }
  if (digits.length <= 5) {
    return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  }
  if (digits.length <= 8) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  }
  if (digits.length <= 12) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  }
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
}

/// Máscara progressiva enquanto o usuário digita — CPF até 11 dígitos,
/// CNPJ a partir do 12º (o próprio tamanho decide o formato, nunca uma
/// escolha explícita de "pessoa física/jurídica" na interface).
export function formatCpfCnpj(rawValue: string): string {
  const digits = rawValue.replace(DIGITS_ONLY, "").slice(0, 14);
  return digits.length > 11 ? formatCnpj(digits) : formatCpf(digits);
}

function isValidCpf(digits: string): boolean {
  if (/^(\d)\1{10}$/.test(digits)) {
    return false;
  }
  let sum = 0;
  for (let i = 1; i <= 9; i++) {
    sum += Number(digits.charAt(i - 1)) * (11 - i);
  }
  let checkDigit1 = (sum * 10) % 11;
  if (checkDigit1 === 10) {
    checkDigit1 = 0;
  }
  if (checkDigit1 !== Number(digits.charAt(9))) {
    return false;
  }

  sum = 0;
  for (let i = 1; i <= 10; i++) {
    sum += Number(digits.charAt(i - 1)) * (12 - i);
  }
  let checkDigit2 = (sum * 10) % 11;
  if (checkDigit2 === 10) {
    checkDigit2 = 0;
  }
  return checkDigit2 === Number(digits.charAt(10));
}

const CNPJ_WEIGHTS_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const CNPJ_WEIGHTS_2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

function cnpjCheckDigit(digits: string, weights: number[]): number {
  const sum = weights.reduce((total, weight, index) => total + Number(digits.charAt(index)) * weight, 0);
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

function isValidCnpj(digits: string): boolean {
  if (/^(\d)\1{13}$/.test(digits)) {
    return false;
  }
  if (cnpjCheckDigit(digits, CNPJ_WEIGHTS_1) !== Number(digits.charAt(12))) {
    return false;
  }
  return cnpjCheckDigit(digits, CNPJ_WEIGHTS_2) === Number(digits.charAt(13));
}

/// Valida o dígito verificador real de CPF (11 dígitos) ou CNPJ (14
/// dígitos) — nunca aceita outro tamanho, nem uma sequência de dígitos
/// iguais (`00000000000` etc., matematicamente "válida" pelo dígito
/// verificador mas nunca um documento real).
export function isValidCpfCnpj(value: string): boolean {
  const digits = value.replace(DIGITS_ONLY, "");
  if (digits.length === 11) {
    return isValidCpf(digits);
  }
  if (digits.length === 14) {
    return isValidCnpj(digits);
  }
  return false;
}
