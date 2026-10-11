import { formatBrazilianPhone, isValidBrazilianPhone } from "@/shared/lib/brazilianPhone";
import {
  formatCreditCardNumber,
  formatPostalCode,
  isValidCreditCardCcv,
  isValidCreditCardExpiry,
  isValidCreditCardNumber,
  isValidPostalCode,
} from "@/shared/lib/creditCard";
import { TextField } from "./TextField";
import styles from "./CreditCardFields.module.css";

export interface CreditCardFieldsValue {
  cardHolderName: string;
  cardNumber: string;
  cardExpiryMonth: string;
  cardExpiryYear: string;
  cardCcv: string;
  postalCode: string;
  addressNumber: string;
  phone: string;
}

export const EMPTY_CREDIT_CARD_FIELDS: CreditCardFieldsValue = {
  cardHolderName: "",
  cardNumber: "",
  cardExpiryMonth: "",
  cardExpiryYear: "",
  cardCcv: "",
  postalCode: "",
  addressNumber: "",
  phone: "",
};

export type CreditCardFieldErrors = Partial<Record<keyof CreditCardFieldsValue, string>>;

/// Validação real (dígito verificador de Luhn, validade não vencida,
/// CEP/CVV com tamanho correto) — reaproveitada por todo lugar que
/// coleta cartão (onboarding do Personal, do FitOS Livre e
/// `/painel/assinatura`), nunca três implementações do mesmo formulário.
export function validateCreditCardFields(card: CreditCardFieldsValue): CreditCardFieldErrors {
  const errors: CreditCardFieldErrors = {};
  if (!card.cardHolderName.trim()) {
    errors.cardHolderName = "Informe o nome impresso no cartão.";
  }
  if (!isValidCreditCardNumber(card.cardNumber)) {
    errors.cardNumber = "Informe um número de cartão válido.";
  }
  if (!isValidCreditCardExpiry(card.cardExpiryMonth, card.cardExpiryYear)) {
    errors.cardExpiryMonth = "Validade inválida ou vencida.";
  }
  if (!isValidCreditCardCcv(card.cardCcv)) {
    errors.cardCcv = "Informe um CVV válido.";
  }
  if (!isValidPostalCode(card.postalCode)) {
    errors.postalCode = "Informe um CEP válido.";
  }
  if (!card.addressNumber.trim()) {
    errors.addressNumber = "Informe o número do endereço.";
  }
  if (!isValidBrazilianPhone(card.phone)) {
    errors.phone = "Informe um celular válido, com DDD.";
  }
  return errors;
}

interface CreditCardFieldsProps {
  value: CreditCardFieldsValue;
  onChange: (value: CreditCardFieldsValue) => void;
  errors?: CreditCardFieldErrors;
  /// FIT-150: o celular já vem do cadastro — não pede de novo.
  hidePhone?: boolean;
}

/// Checkout embutido de cartão (FIT-128) — decisão de Murilo: "toda a
/// transação deve ocorrer no FitOS, o Asaas deve ser o gateway; o
/// cliente deve completar 100% do processo de checkout" no FitOS.
/// Reaproveitado pelo onboarding do Personal, do FitOS Livre e por
/// `/painel/assinatura` (cadastrar/atualizar cartão depois) — a mesma
/// coleta de dados, sempre enviada a `/api/tenancy/minha-assinatura/cartao`,
/// nunca duas implementações do mesmo formulário.
///
/// Número do cartão e CVV nunca são persistidos pelo FitOS em nenhum
/// lugar — passam só em trânsito até o Asaas tokenizar
/// (`src/modules/billing/checkout.ts`).
export function CreditCardFields({ value, onChange, errors, hidePhone = false }: CreditCardFieldsProps) {
  function set<K extends keyof CreditCardFieldsValue>(key: K, next: string) {
    onChange({ ...value, [key]: next });
  }

  return (
    <div className={styles.grid}>
      <TextField
        label="Nome impresso no cartão"
        name="cardHolderName"
        type="text"
        autoComplete="cc-name"
        value={value.cardHolderName}
        onChange={(event) => set("cardHolderName", event.target.value)}
        error={errors?.cardHolderName}
        required
      />
      <TextField
        label="Número do cartão"
        name="cardNumber"
        type="text"
        inputMode="numeric"
        autoComplete="cc-number"
        placeholder="0000 0000 0000 0000"
        value={value.cardNumber}
        onChange={(event) => set("cardNumber", formatCreditCardNumber(event.target.value))}
        error={errors?.cardNumber}
        required
      />
      <div className={styles.row}>
        <TextField
          label="Mês (MM)"
          name="cardExpiryMonth"
          type="text"
          inputMode="numeric"
          autoComplete="cc-exp-month"
          placeholder="10"
          maxLength={2}
          value={value.cardExpiryMonth}
          onChange={(event) => set("cardExpiryMonth", event.target.value.replace(/\D/g, "").slice(0, 2))}
          error={errors?.cardExpiryMonth}
          required
        />
        <TextField
          label="Ano (AAAA)"
          name="cardExpiryYear"
          type="text"
          inputMode="numeric"
          autoComplete="cc-exp-year"
          placeholder="2030"
          maxLength={4}
          value={value.cardExpiryYear}
          onChange={(event) => set("cardExpiryYear", event.target.value.replace(/\D/g, "").slice(0, 4))}
          error={errors?.cardExpiryYear}
          required
        />
        <TextField
          label="CVV"
          name="cardCcv"
          type="text"
          inputMode="numeric"
          autoComplete="cc-csc"
          placeholder="123"
          maxLength={4}
          value={value.cardCcv}
          onChange={(event) => set("cardCcv", event.target.value.replace(/\D/g, "").slice(0, 4))}
          error={errors?.cardCcv}
          required
        />
      </div>
      <TextField
        label="CEP"
        name="postalCode"
        type="text"
        inputMode="numeric"
        autoComplete="postal-code"
        placeholder="00000-000"
        value={value.postalCode}
        onChange={(event) => set("postalCode", formatPostalCode(event.target.value))}
        error={errors?.postalCode}
        required
      />
      <TextField
        label="Número do endereço"
        name="addressNumber"
        type="text"
        autoComplete="address-line2"
        value={value.addressNumber}
        onChange={(event) => set("addressNumber", event.target.value)}
        error={errors?.addressNumber}
        required
      />
      {hidePhone ? null : (
        <TextField
          label="Celular"
          name="checkoutPhone"
          type="tel"
          autoComplete="tel"
          placeholder="(11) 91234-5678"
          value={value.phone}
          onChange={(event) => set("phone", formatBrazilianPhone(event.target.value))}
          error={errors?.phone}
          required
        />
      )}
    </div>
  );
}
