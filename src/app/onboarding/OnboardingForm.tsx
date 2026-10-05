"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ExperienceLevel, IndividualObjective, WeeklyAvailability } from "@prisma/client";
import { Button, ChipGroup, CreditCardFields, EMPTY_CREDIT_CARD_FIELDS, FormAlert, ProgressBar, TextField, useToast, validateCreditCardFields, type CreditCardFieldErrors, type CreditCardFieldsValue } from "@/shared/ui";
import { formatCpfCnpj, isValidCpfCnpj } from "@/shared/lib/cpfCnpj";
import { formatCentsBRL } from "@/shared/lib/money";
import { AVAILABILITY_LABELS, EXPERIENCE_LABELS, OBJECTIVE_LABELS } from "../painel/individualProfileLabels";
import type { OnboardingPlan } from "../onboarding-personal/PersonalOnboardingWizard";
import styles from "../_entrada/Entrada.module.css";

interface Props {
  initialObjective: IndividualObjective | null;
  initialExperienceLevel: ExperienceLevel | null;
  initialWeeklyAvailability: WeeklyAvailability | null;
  initialCpfCnpj: string | null;
  plans: OnboardingPlan[];
  initialPlanId: string | null;
}

type Step = 1 | 2 | 3 | 4;
const STEP_TITLES: Record<Step, string> = { 1: "Objetivo", 2: "Dias", 3: "Experiência", 4: "Plano e pagamento" };
const options = <T extends string>(labels: Record<T, string>) => (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));
const dateFmt = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", timeZone: "America/Sao_Paulo" });

/// Onboarding do FitOS Livre (EPIC-30): três toques (objetivo, dias e
/// experiência; cada toque já avança), depois plano e pagamento. Ao
/// concluir, as respostas viram o plano inicial e a pessoa cai no Início
/// com o treino de hoje. Termos aceitos ao criar a conta (FIT-164).
export function OnboardingForm(props: Props) {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState<Step>(1);
  const [objective, setObjective] = useState<IndividualObjective | null>(props.initialObjective);
  const [experience, setExperience] = useState<ExperienceLevel | null>(props.initialExperienceLevel);
  const [availability, setAvailability] = useState<WeeklyAvailability | null>(props.initialWeeklyAvailability);
  const [cpfCnpj, setCpfCnpj] = useState(props.initialCpfCnpj ? formatCpfCnpj(props.initialCpfCnpj) : "");
  const [card, setCard] = useState<CreditCardFieldsValue>(EMPTY_CREDIT_CARD_FIELDS);
  const [cardErrors, setCardErrors] = useState<CreditCardFieldErrors>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [startedAt] = useState(() => Date.now());

  const plan = props.plans.find((entry) => entry.id === props.initialPlanId) ?? props.plans[0] ?? null;
  const paid = (plan?.priceCents ?? 0) > 0;
  const trialDays = plan?.trialDays ?? 30;
  const firstCharge = new Date(startedAt + trialDays * 86_400_000);

  async function finish() {
    if (!plan || busy) return;
    const found: Record<string, string> = {};
    if (!isValidCpfCnpj(cpfCnpj)) found.cpfCnpj = "Informe um CPF ou CNPJ válido.";
    if (paid) {
      const cardFound = validateCreditCardFields(card);
      setCardErrors(cardFound);
      if (Object.keys(cardFound).length > 0) found.card = "Confira os dados do cartão.";
    }
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    setFormError(null);
    const response = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objective, experienceLevel: experience, weeklyAvailability: availability, cpfCnpj, termsAccepted: true, planId: plan.id }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setFormError(body?.message ?? "Não foi possível salvar. Confira os dados e tente de novo.");
      setBusy(false);
      return;
    }
    if (paid) {
      const cardResponse = await fetch("/api/tenancy/minha-assinatura/cartao", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(card) });
      if (!cardResponse.ok) {
        const body = await cardResponse.json().catch(() => null);
        setFormError(`${body?.message ?? "Não foi possível salvar o cartão."} Seu espaço já está pronto; você pode cadastrar o cartão depois em Assinatura.`);
        setBusy(false);
        return;
      }
    }
    toast.show("Seu plano está pronto");
    router.push("/painel");
    router.refresh();
  }

  return (
    <>
      <div>
        <p className={styles.eyebrow}>
          Passo {step} de 4 · {STEP_TITLES[step]}
        </p>
        <ProgressBar value={(100 * step) / 4} label="Progresso do cadastro" valueText={`Passo ${step} de 4`} />
      </div>
      {formError ? <FormAlert variant="error">{formError}</FormAlert> : null}

      {step === 1 ? (
        <div className={styles.form}>
          <h1 className={styles.title}>O que você quer?</h1>
          <ChipGroup label="Objetivo" variant="card" tone="accent" value={objective} onChange={(value) => { setObjective(value); setStep(2); }} options={options(OBJECTIVE_LABELS)} />
        </div>
      ) : null}

      {step === 2 ? (
        <div className={styles.form}>
          <h1 className={styles.title}>Quantos dias?</h1>
          <ChipGroup label="Dias por semana" variant="card" tone="accent" value={availability} onChange={(value) => { setAvailability(value); setStep(3); }} options={options(AVAILABILITY_LABELS)} />
        </div>
      ) : null}

      {step === 3 ? (
        <div className={styles.form}>
          <h1 className={styles.title}>Você já treina?</h1>
          <ChipGroup label="Experiência com treino" variant="card" tone="accent" value={experience} onChange={(value) => { setExperience(value); setStep(4); }} options={options(EXPERIENCE_LABELS)} />
        </div>
      ) : null}

      {step === 4 && plan ? (
        <div className={styles.form}>
          <h1 className={styles.title}>{plan.name}</h1>
          <div className={styles.card}>
            <span className={styles.cardText}>
              <span className={styles.cardTitle}>{objective ? OBJECTIVE_LABELS[objective] : ""}</span>
              <span className={styles.muted}>
                {availability ? AVAILABILITY_LABELS[availability] : ""} · {experience ? EXPERIENCE_LABELS[experience] : ""}
              </span>
            </span>
          </div>
          <p className={styles.lead}>
            {paid ? `${formatCentsBRL(plan.priceCents)} por mês. Nada é cobrado agora: a primeira cobrança é em ${dateFmt.format(firstCharge)}, depois dos ${trialDays} dias grátis.` : "Sem cobrança."}
          </p>
          <TextField label="CPF ou CNPJ" name="cpfCnpj" inputMode="numeric" value={cpfCnpj} onChange={(event) => setCpfCnpj(formatCpfCnpj(event.target.value))} error={errors.cpfCnpj} />
          {paid ? <CreditCardFields value={card} onChange={setCard} errors={cardErrors} /> : null}
          <Button type="button" size="xl" block disabled={busy} onClick={() => void finish()}>
            {busy ? "Montando seu plano…" : "Criar meu plano"}
          </Button>
        </div>
      ) : null}

      {step > 1 ? (
        <div className={styles.alt}>
          <Button type="button" variant="quiet" block onClick={() => setStep((step - 1) as Step)}>
            Voltar
          </Button>
        </div>
      ) : null}
    </>
  );
}
