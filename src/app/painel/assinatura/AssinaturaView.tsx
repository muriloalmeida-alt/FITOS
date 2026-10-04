"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ActionRow,
  Button,
  ChipGroup,
  CreditCardFields,
  EMPTY_CREDIT_CARD_FIELDS,
  FormAlert,
  NextStepCard,
  ProgressBar,
  Sheet,
  Tag,
  TextField,
  useToast,
  validateCreditCardFields,
  type CreditCardFieldErrors,
  type CreditCardFieldsValue,
  type TagTone,
} from "@/shared/ui";
import { formatCentsBRL } from "@/shared/lib/money";
import { formatBrazilianPhone } from "@/shared/lib/brazilianPhone";
import { requestJson } from "../_workout-builder/apiClient";
import styles from "./AssinaturaView.module.css";

export type SubscriptionState = "trial" | "ativa" | "pendente" | "cancelada";

export interface PlanChoice {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  cycle: "MENSAL" | "ANUAL";
  studentLimit: number | null;
  /// Motivo do bloqueio quando o plano não comporta os alunos ativos.
  blockedReason: string | null;
}

export interface CurrentSubscription {
  planId: string;
  planName: string;
  priceCents: number;
  cycle: "MENSAL" | "ANUAL";
  state: SubscriptionState;
  trial: { daysLeft: number; totalDays: number; endsLabel: string } | null;
  nextChargeLabel: string | null;
  canceledLabel: string | null;
  card: { brand: string; last4: string } | null;
  needsCard: boolean;
}

interface AssinaturaViewProps {
  subscription: CurrentSubscription | null;
  plans: PlanChoice[];
  /// Só para o Personal (o FitOS Livre não tem alunos).
  usage: { active: number; limit: number | null } | null;
  /// Celular do cadastro, usado no cartão sem pedir de novo (FIT-150).
  profilePhone: string | null;
}

const STATE_TAG: Record<SubscriptionState, { label: string; tone: TagTone }> = {
  trial: { label: "Teste grátis", tone: "accent" },
  ativa: { label: "Ativa", tone: "ok" },
  pendente: { label: "Pagamento pendente", tone: "error" },
  cancelada: { label: "Cancelada", tone: "muted" },
};
const CYCLE: Record<"MENSAL" | "ANUAL", string> = { MENSAL: "mês", ANUAL: "ano" };
const CANCEL_REASONS = ["Está caro", "Parei de atender", "Faltou algum recurso", "Vou usar outra ferramenta", "Outro"];

/// Assinatura FitOS (FIT-150, P8 do protótipo): plano, status, teste
/// grátis, próxima cobrança e uso de alunos; cartão, troca de plano,
/// cancelamento e "Assinar de novo" (BK-18), cada um numa sheet.
export function AssinaturaView({ subscription, plans, usage, profilePhone }: AssinaturaViewProps) {
  const router = useRouter();
  const toast = useToast();
  const [sheet, setSheet] = useState<null | "card" | "plan" | "cancel">(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [card, setCard] = useState<CreditCardFieldsValue>(EMPTY_CREDIT_CARD_FIELDS);
  const [cardErrors, setCardErrors] = useState<CreditCardFieldErrors>({});
  const [pickedPlan, setPickedPlan] = useState<PlanChoice | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [otherReason, setOtherReason] = useState("");

  const cancelled = subscription?.state === "cancelada";
  const keeps = usage ? "Seus alunos, treinos e histórico" : "Seus treinos e seu histórico";
  // FitOS Livre (FIT-161): com um plano só, que já é o atual, não há o que trocar.
  const onlyCurrent = subscription !== null && !cancelled && plans.length === 1 && plans[0]!.id === subscription.planId;
  const usagePercent = usage && usage.limit ? Math.min(100, (100 * usage.active) / usage.limit) : null;

  function close() {
    setSheet(null);
    setError(null);
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível concluir.");
    } finally {
      setBusy(false);
    }
  }

  function openCard() {
    setCard({ ...EMPTY_CREDIT_CARD_FIELDS, phone: profilePhone ? formatBrazilianPhone(profilePhone) : "" });
    setCardErrors({});
    setError(null);
    setSheet("card");
  }

  function openPlan(plan: PlanChoice) {
    setPickedPlan(plan);
    setError(null);
    setSheet("plan");
  }

  function openCancel() {
    setReason(null);
    setOtherReason("");
    setError(null);
    setSheet("cancel");
  }

  const resubscribePlan = subscription ? (plans.find((plan) => plan.id === subscription.planId && !plan.blockedReason) ?? null) : null;

  return (
    <div className={styles.view}>
      {subscription ? (
        <section className={styles.hero} aria-label="Sua assinatura">
          <div className={styles.heroTop}>
            <div>
              <p className={styles.planName}>{subscription.planName}</p>
              <p className={styles.price}>
                {formatCentsBRL(subscription.priceCents)} / {CYCLE[subscription.cycle]}
              </p>
            </div>
            <Tag tone={STATE_TAG[subscription.state].tone}>{STATE_TAG[subscription.state].label}</Tag>
          </div>
          {subscription.trial ? (
            <div className={styles.meter}>
              <ProgressBar
                value={(100 * (subscription.trial.totalDays - subscription.trial.daysLeft)) / subscription.trial.totalDays}
                label="Teste grátis"
                valueText={`${subscription.trial.daysLeft} dias restantes`}
              />
              <span>
                {subscription.trial.daysLeft === 1 ? "Último dia" : `${subscription.trial.daysLeft} dias restantes`} · termina em {subscription.trial.endsLabel}
              </span>
            </div>
          ) : null}
          {subscription.nextChargeLabel ? <p className={styles.line}>Próxima cobrança: {subscription.nextChargeLabel}</p> : null}
          {subscription.canceledLabel ? <p className={styles.line}>Cancelada em {subscription.canceledLabel}. {keeps} continuam aqui.</p> : null}
          {usage ? (
            <div className={styles.meter}>
              {usagePercent !== null ? <ProgressBar value={usagePercent} label="Alunos ativos" valueText={`${usage.active} de ${usage.limit}`} /> : null}
              <span>{usage.limit ? `${usage.active} de ${usage.limit} alunos ativos` : `${usage.active} alunos ativos · sem limite`}</span>
            </div>
          ) : null}
        </section>
      ) : (
        <p className={styles.muted}>Você ainda não tem um plano. Escolha um abaixo.</p>
      )}

      {subscription?.state === "pendente" ? (
        <div className={styles.alert} role="alert">
          <span>O último pagamento não passou. Atualize o cartão para continuar sem interrupção.</span>
          <Button type="button" onClick={openCard}>
            Atualizar cartão
          </Button>
        </div>
      ) : null}

      {cancelled && resubscribePlan ? (
        <div className={styles.next}>
          <NextStepCard eyebrow="Volte quando quiser" title="Assinar de novo" description={`${resubscribePlan.name} · ${formatCentsBRL(resubscribePlan.priceCents)} / ${CYCLE[resubscribePlan.cycle]}`} onClick={() => openPlan(resubscribePlan)} icon="arrow" />
        </div>
      ) : null}

      {subscription && subscription.needsCard ? (
        <>
          <h2 className={styles.cap}>Pagamento</h2>
          <ActionRow
            title="Cartão"
            description={subscription.card ? `${subscription.card.brand} •••• ${subscription.card.last4}` : "Nenhum cartão cadastrado"}
            trailing={
              <Button type="button" variant="quiet" onClick={openCard}>
                {subscription.card ? "Atualizar" : "Cadastrar"}
              </Button>
            }
          />
        </>
      ) : null}

      {onlyCurrent ? null : <h2 className={styles.cap}>{subscription && !cancelled ? "Trocar de plano" : "Planos"}</h2>}
      {plans.length === 0 ? <p className={styles.muted}>Nenhum plano disponível no momento.</p> : null}
      <ul className={styles.list}>
        {(onlyCurrent ? [] : plans).map((plan) => {
          const current = subscription && !cancelled && subscription.planId === plan.id;
          const limit = plan.studentLimit === null ? "Alunos sem limite" : `Até ${plan.studentLimit} alunos`;
          return (
            <li key={plan.id}>
              <ActionRow
                title={
                  <>
                    {plan.name} {current ? <Tag tone="ok">Atual</Tag> : null}
                  </>
                }
                description={
                  <>
                    {formatCentsBRL(plan.priceCents)} / {CYCLE[plan.cycle]}
                    {usage ? ` · ${limit}` : ""}
                    {plan.blockedReason ? <span className={styles.blocked}>{plan.blockedReason}</span> : null}
                  </>
                }
                trailing={
                  current ? null : (
                    <Button type="button" variant="quiet" disabled={plan.blockedReason !== null} onClick={() => openPlan(plan)} aria-label={`Escolher ${plan.name}`}>
                      Escolher
                    </Button>
                  )
                }
              />
            </li>
          );
        })}
      </ul>

      {subscription && !cancelled ? (
        <div className={styles.cancel}>
          <Button type="button" variant="quiet" onClick={openCancel}>
            Cancelar assinatura
          </Button>
        </div>
      ) : null}

      {/* Cartão */}
      <Sheet
        open={sheet === "card"}
        onClose={close}
        title={subscription?.card ? "Atualizar cartão" : "Cadastrar cartão"}
        description={profilePhone ? "CPF/CNPJ e celular vêm do seu cadastro." : "CPF/CNPJ vem do seu cadastro."}
        footer={
          <>
            <Button type="button" block disabled={busy} onClick={() => {
              const errors = validateCreditCardFields(card);
              setCardErrors(errors);
              if (Object.keys(errors).length > 0) return;
              void run(async () => {
                await requestJson("/api/tenancy/minha-assinatura/cartao", { method: "POST", body: JSON.stringify(card) });
                toast.show("Cartão salvo");
                setCard(EMPTY_CREDIT_CARD_FIELDS);
                close();
                router.refresh();
              });
            }}>
              {busy ? "Salvando…" : "Salvar cartão"}
            </Button>
            <Button type="button" variant="quiet" block onClick={close}>
              Agora não
            </Button>
          </>
        }
      >
        {error ? <FormAlert>{error}</FormAlert> : null}
        <CreditCardFields value={card} onChange={setCard} errors={cardErrors} hidePhone={profilePhone !== null} />
      </Sheet>

      {/* Trocar / assinar */}
      <Sheet
        open={sheet === "plan" && pickedPlan !== null}
        onClose={close}
        title={!subscription || cancelled ? `Assinar ${pickedPlan?.name ?? ""}` : `Trocar para ${pickedPlan?.name ?? ""}?`}
        description={
          pickedPlan
            ? `${formatCentsBRL(pickedPlan.priceCents)} / ${CYCLE[pickedPlan.cycle]}${pickedPlan.studentLimit !== null && usage ? ` · até ${pickedPlan.studentLimit} alunos` : ""}. ${
                cancelled ? "O teste grátis não se repete e o cartão precisa ser cadastrado de novo." : subscription ? "O novo valor vale a partir da próxima cobrança." : ""
              }`
            : undefined
        }
        footer={
          <>
            <Button type="button" block disabled={busy} onClick={() => void run(async () => {
              await requestJson("/api/tenancy/minha-assinatura", { method: "POST", body: JSON.stringify({ planId: pickedPlan!.id }) });
              toast.show(cancelled || !subscription ? `Assinatura ${pickedPlan!.name} ativa` : `Plano trocado para ${pickedPlan!.name}`);
              close();
              router.refresh();
            })}>
              {!subscription || cancelled ? "Assinar" : "Confirmar troca"}
            </Button>
            <Button type="button" variant="quiet" block onClick={close}>
              Voltar
            </Button>
          </>
        }
      >
        {error ? <FormAlert>{error}</FormAlert> : null}
      </Sheet>

      {/* Cancelar */}
      <Sheet
        open={sheet === "cancel"}
        onClose={close}
        title="Cancelar assinatura?"
        description={`A cobrança do FitOS para. ${keeps} continuam guardados, e você pode assinar de novo quando quiser (sem novo teste grátis).`}
        footer={
          <>
            <Button type="button" variant="danger" block disabled={busy || !reason || (reason === "Outro" && otherReason.trim().length === 0)} onClick={() => void run(async () => {
              await requestJson("/api/tenancy/minha-assinatura/cancelar", { method: "POST", body: JSON.stringify({ reason: reason === "Outro" ? otherReason.trim() : reason }) });
              toast.show("Assinatura cancelada");
              close();
              router.refresh();
            })}>
              Cancelar assinatura
            </Button>
            <Button type="button" variant="quiet" block onClick={close}>
              Manter assinatura
            </Button>
          </>
        }
      >
        {error ? <FormAlert>{error}</FormAlert> : null}
        <div className={styles.stack}>
          <ChipGroup label="Por que você está saindo?" showLabel tone="accent" value={reason} onChange={setReason} options={CANCEL_REASONS.map((item) => ({ value: item, label: item }))} />
          {reason === "Outro" ? <TextField label="Conte para a gente" value={otherReason} maxLength={300} onChange={(event) => setOtherReason(event.target.value)} /> : null}
        </div>
      </Sheet>
    </div>
  );
}
