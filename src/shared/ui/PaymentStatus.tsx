import styles from "./PaymentStatus.module.css";

/// Mesmos 4 estados de `StudentChargeStatus` (`prisma/schema.prisma`) —
/// nunca reinventa uma nomenclatura própria de UI para não divergir do
/// domínio.
export type PaymentStatusValue = "PENDENTE" | "PAGO" | "ATRASADO" | "CANCELADO";

const LABEL: Record<PaymentStatusValue, string> = {
  PENDENTE: "Pendente",
  PAGO: "Pago",
  ATRASADO: "Atrasado",
  CANCELADO: "Cancelado",
};

/// Símbolo textual por estado — "status não depende apenas de cor"
/// (critério de aceite do pacote): mesmo daltônico ou sem cor nenhuma
/// (impressão, alto contraste), os 4 estados continuam distinguíveis.
const SYMBOL: Record<PaymentStatusValue, string> = {
  PENDENTE: "○",
  PAGO: "✓",
  ATRASADO: "!",
  CANCELADO: "✕",
};

const TONE_CLASS: Record<PaymentStatusValue, string> = {
  PENDENTE: "neutral",
  PAGO: "positive",
  ATRASADO: "warning",
  CANCELADO: "neutral",
};

interface PaymentStatusProps {
  status: PaymentStatusValue;
}

export function PaymentStatus({ status }: PaymentStatusProps) {
  return (
    <span className={`${styles.pill} ${styles[TONE_CLASS[status]]}`}>
      <span aria-hidden="true">{SYMBOL[status]}</span> {LABEL[status]}
    </span>
  );
}
