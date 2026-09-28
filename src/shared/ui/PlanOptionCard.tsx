import { formatCentsBRL } from "@/shared/lib/money";
import styles from "./PlanOptionCard.module.css";

const BILLING_CYCLE_LABEL: Record<string, string> = {
  MENSAL: "mês",
  ANUAL: "ano",
};

export interface PlanOptionCardPlan {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  billingCycle: string;
  studentLimit: number | null;
  trialDays: number | null;
}

interface PlanOptionCardProps {
  plan: PlanOptionCardPlan;
  groupName: string;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
  /// `false` no onboarding do FitOS Livre (FIT-126): "alunos ativos" é um
  /// conceito exclusivo do plano do Personal — mostrar essa linha para um
  /// plano `INDIVIDUAL` seria uma informação sem sentido para quem treina
  /// só a si mesmo. Padrão `true` (Personal, onde a linha é relevante).
  showStudentLimit?: boolean;
}

/// Cartão de escolha de plano (FIT-126) — reaproveitado pelo onboarding do
/// Personal e pelo do FitOS Livre: os dois precisam da mesma decisão
/// ("qual plano/produto"), sempre a partir do catálogo real do backend
/// (`listActivePlansForAudience`), nunca uma lista fixa na interface.
/// Nunca pede dados de cartão aqui — essa é uma etapa separada
/// (`CreditCardFields`, FIT-128), só quando o plano escolhido é pago.
///
/// O pacote visual 2026 (FIT-131, tela 05) destaca um cartão como "MAIS
/// ESCOLHIDO" com fundo navy — decisão de produto que este componente não
/// tem como afirmar de verdade (não existe hoje nenhum dado real de
/// popularidade de plano no catálogo, e "nenhum valor de print hardcoded"
/// é critério de aceite explícito do próprio pacote). O mesmo contraste
/// visual (cartão navy elevado entre cartões claros) é aplicado aqui a um
/// estado real e verificável: o cartão que o próprio usuário selecionou
/// (`selected`), rotulado "Selecionado" — nunca uma preferência
/// fabricada.
export function PlanOptionCard({ plan, groupName, selected, onSelect, disabled, showStudentLimit = true }: PlanOptionCardProps) {
  const cycleLabel = BILLING_CYCLE_LABEL[plan.billingCycle] ?? "mês";
  return (
    <label className={selected ? `${styles.card} ${styles.cardSelected}` : styles.card}>
      <input
        className={styles.input}
        type="radio"
        name={groupName}
        value={plan.id}
        checked={selected}
        onChange={onSelect}
        disabled={disabled}
      />
      <span className={styles.body}>
        {selected ? <span className={styles.selectedBadge}>Selecionado</span> : null}
        <span className={styles.name}>{plan.name}</span>
        {plan.description ? <span className={styles.description}>{plan.description}</span> : null}
        <span className={styles.priceRow}>
          <span className={styles.price}>{formatCentsBRL(plan.priceCents)}</span>
          <span className={styles.priceCycle}>/{cycleLabel}</span>
        </span>
        {showStudentLimit ? (
          <span className={styles.detail}>
            {plan.studentLimit === null ? "Alunos ativos: sem limite" : `Alunos ativos: até ${plan.studentLimit}`}
          </span>
        ) : null}
        {plan.trialDays !== null ? (
          <span className={styles.trial}>
            {plan.trialDays} dias grátis, depois {formatCentsBRL(plan.priceCents)}/{cycleLabel}
          </span>
        ) : null}
      </span>
    </label>
  );
}
