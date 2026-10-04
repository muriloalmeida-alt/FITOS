"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ExperienceLevel, IndividualObjective, WeeklyAvailability } from "@prisma/client";
import { Button, ChipGroup, CreditCardFields, EMPTY_CREDIT_CARD_FIELDS, FormAlert, ProgressBar, TextField, validateCreditCardFields, type CreditCardFieldErrors, type CreditCardFieldsValue } from "@/shared/ui";
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
const STEP_TITLES: Record<Step, string> = { 1: "Objetivo", 2: "Sua rotina", 3: "Plano e pagamento", 4: "Revisão" };
const options = <T extends string>(labels: Record<T, string>) => (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));
const dateFmt = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", timeZone: "America/Sao_Paulo" });

/// Onboarding do FitOS Livre em 4 passos (FIT-167, E6 do protótipo):
/// objetivo; experiência e dias por semana (em cartões); plano e
/// pagamento; revisão levando direto a "Montar meu primeiro treino". As
/// respostas não geram prescrição automática. Termos aceitos ao criar a
/// conta (FIT-164).
export function OnboardingForm(props: Props) {
  const router = useRouter();
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

  function next() {
    const found: Record<string, string> = {};
    if (step === 1 && !objective) found.objective = "Escolha um objetivo.";
    if (step === 2) {
      if (!experience) found.experience = "Escolha sua experiência.";
      if (!availability) found.availability = "Escolha quantos dias por semana.";
    }
    if (step === 3) {
      if (!isValidCpfCnpj(cpfCnpj)) found.cpfCnpj = "Informe um CPF ou CNPJ válido.";
      if (paid) {
        const cardFound = validateCreditCardFields(card);
        setCardErrors(cardFound);
        if (Object.keys(cardFound).length > 0) found.card = "Confira os dados do cartão.";
      }
    }
    setErrors(found);
    if (Object.keys(found).length === 0) setStep((step + 1) as Step);
  }

  async function finish() {
    if (!plan || busy) return;
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
    router.push("/painel/meus-treinos/novo");
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
          <h1 className={styles.title}>O que você quer alcançar?</h1>
          <ChipGroup label="Objetivo" variant="card" tone="accent" value={objective} onChange={setObjective} options={options(OBJECTIVE_LABELS)} />
          {errors.objective ? <p role="alert" className={styles.muted}>{errors.objective}</p> : null}
        </div>
      ) : null}

      {step === 2 ? (
        <div className={styles.form}>
          <h1 className={styles.title}>Sua rotina</h1>
          <ChipGroup label="Experiência com treino" showLabel variant="card" tone="accent" columns={3} value={experience} onChange={setExperience} options={options(EXPERIENCE_LABELS)} />
          {errors.experience ? <p role="alert" className={styles.muted}>{errors.experience}</p> : null}
          <ChipGroup label="Dias por semana" showLabel variant="card" tone="accent" value={availability} onChange={setAvailability} options={options(AVAILABILITY_LABELS)} />
          {errors.availability ? <p role="alert" className={styles.muted}>{errors.availability}</p> : null}
        </div>
      ) : null}

      {step === 3 && plan ? (
        <div className={styles.form}>
          <h1 className={styles.title}>{plan.name}</h1>
          <p className={styles.lead}>
            {paid ? `${formatCentsBRL(plan.priceCents)} por mês. Nada é cobrado agora: a primeira cobrança é em ${dateFmt.format(firstCharge)}, depois dos ${trialDays} dias grátis.` : "Sem cobrança."}
          </p>
          <TextField label="CPF ou CNPJ" name="cpfCnpj" inputMode="numeric" value={cpfCnpj} onChange={(event) => setCpfCnpj(formatCpfCnpj(event.target.value))} error={errors.cpfCnpj} />
          {paid ? <CreditCardFields value={card} onChange={setCard} errors={cardErrors} /> : null}
        </div>
      ) : null}

      {step === 4 && plan ? (
        <div className={styles.form}>
          <h1 className={styles.title}>Tudo certo?</h1>
          <div className={styles.card}>
            <span className={styles.cardText}>
              <span className={styles.cardTitle}>{objective ? OBJECTIVE_LABELS[objective] : ""}</span>
              <span className={styles.muted}>
                {experience ? EXPERIENCE_LABELS[experience] : ""} · {availability ? AVAILABILITY_LABELS[availability] : ""}
              </span>
            </span>
          </div>
          <div className={styles.card}>
            <span className={styles.cardText}>
              <span className={styles.cardTitle}>{plan.name}</span>
              <span className={styles.muted}>{paid ? `${trialDays} dias grátis · primeira cobrança em ${dateFmt.format(firstCharge)}` : "Sem cobrança"}</span>
            </span>
          </div>
          <Button type="button" size="xl" block disabled={busy} onClick={() => void finish()}>
            {busy ? "Preparando…" : "Montar meu primeiro treino"}
          </Button>
        </div>
      ) : null}

      <div className={styles.alt}>
        {step < 4 ? (
          <Button type="button" size="lg" block onClick={next}>
            Continuar
          </Button>
        ) : null}
        {step > 1 ? (
          <Button type="button" variant="quiet" block onClick={() => setStep((step - 1) as Step)}>
            Voltar
          </Button>
        ) : null}
      </div>
    </>
  );
}
