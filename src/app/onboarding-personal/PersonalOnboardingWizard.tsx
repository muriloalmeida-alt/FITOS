"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PersonalStudentRangeEstimate } from "@prisma/client";
import { Button, ChipGroup, CreditCardFields, EMPTY_CREDIT_CARD_FIELDS, FormAlert, ProgressBar, Tag, TextField, validateCreditCardFields, type CreditCardFieldErrors, type CreditCardFieldsValue } from "@/shared/ui";
import { formatBrazilianPhone, isValidBrazilianPhone } from "@/shared/lib/brazilianPhone";
import { formatCpfCnpj, isValidCpfCnpj } from "@/shared/lib/cpfCnpj";
import { formatCentsBRL } from "@/shared/lib/money";
import { STUDENT_RANGE_OPTIONS, studentRangeLabel } from "@/modules/personal-onboarding/studentRangeLabel";
import styles from "../_entrada/Entrada.module.css";

export interface OnboardingPlan {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  billingCycle: "MENSAL" | "ANUAL";
  studentLimit: number | null;
  trialDays: number | null;
}

interface Props {
  initialBusinessName: string;
  plans: OnboardingPlan[];
  initialPlanId: string | null;
}

type Step = 1 | 2 | 3 | 4;
const STEP_TITLES: Record<Step, string> = { 1: "Seu perfil", 2: "Seu plano", 3: "Pagamento", 4: "Revisão" };
const RANGE_MAX: Record<PersonalStudentRangeEstimate, number | null> = { COMECANDO_AGORA: 20, ATE_20: 20, DE_21_A_50: 50, MAIS_DE_50: null };
const dateFmt = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", timeZone: "America/Sao_Paulo" });

/// Plano sugerido pela faixa de alunos: o menor que comporta a faixa.
export function suggestPlan(plans: OnboardingPlan[], range: PersonalStudentRangeEstimate | null): OnboardingPlan | null {
  if (plans.length === 0) return null;
  const max = range ? RANGE_MAX[range] : 20;
  const fits = plans.filter((plan) => plan.studentLimit === null || (max !== null && plan.studentLimit >= max));
  const sorted = [...(fits.length > 0 ? fits : plans)].sort((a, b) => (a.studentLimit ?? Infinity) - (b.studentLimit ?? Infinity) || a.priceCents - b.priceCents);
  return sorted[0] ?? null;
}

/// Onboarding do Personal em 4 passos (FIT-166, E5 do protótipo): perfil
/// (nome do espaço, faixa em cartões, celular, CREF opcional), plano
/// sugerido pela faixa, pagamento com a data da primeira cobrança e
/// revisão com "Começar meus 30 dias grátis". Voltar mantém os dados. Os
/// termos já foram aceitos ao criar a conta (FIT-164).
export function PersonalOnboardingWizard({ initialBusinessName, plans, initialPlanId }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [businessName, setBusinessName] = useState(initialBusinessName);
  const [range, setRange] = useState<PersonalStudentRangeEstimate | null>(null);
  const [phone, setPhone] = useState("");
  const [cref, setCref] = useState("");
  const [planId, setPlanId] = useState<string | null>(initialPlanId);
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [card, setCard] = useState<CreditCardFieldsValue>(EMPTY_CREDIT_CARD_FIELDS);
  const [cardErrors, setCardErrors] = useState<CreditCardFieldErrors>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [startedAt] = useState(() => Date.now());

  const suggested = suggestPlan(plans, range);
  const plan = plans.find((entry) => entry.id === planId) ?? suggested;
  const paid = (plan?.priceCents ?? 0) > 0;
  const trialDays = plan?.trialDays ?? 30;
  const firstCharge = new Date(startedAt + trialDays * 86_400_000);

  function next() {
    const found: Record<string, string> = {};
    if (step === 1) {
      if (businessName.trim().length === 0) found.businessName = "Informe o nome do seu espaço.";
      if (!range) found.range = "Escolha quantos alunos você atende.";
      if (!isValidBrazilianPhone(phone)) found.phone = "Informe um celular válido, com DDD.";
    }
    if (step === 3) {
      if (!isValidCpfCnpj(cpfCnpj)) found.cpfCnpj = "Informe um CPF ou CNPJ válido.";
      if (paid) {
        const cardFound = validateCreditCardFields({ ...card, phone });
        setCardErrors(cardFound);
        if (Object.keys(cardFound).length > 0) found.card = "Confira os dados do cartão.";
      }
    }
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    if (step === 1 && !planId && suggested) setPlanId(suggested.id);
    setStep((step + 1) as Step);
  }

  async function finish() {
    if (!plan || busy) return;
    setBusy(true);
    setFormError(null);
    const response = await fetch("/api/onboarding-personal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, cref: cref.trim() || undefined, cpfCnpj, studentRangeEstimate: range, businessName, termsAccepted: true, planId: plan.id }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setFormError(body?.message ?? "Não foi possível salvar. Confira os dados e tente de novo.");
      setBusy(false);
      return;
    }
    if (paid) {
      const cardResponse = await fetch("/api/tenancy/minha-assinatura/cartao", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...card, phone }) });
      if (!cardResponse.ok) {
        const body = await cardResponse.json().catch(() => null);
        setFormError(`${body?.message ?? "Não foi possível salvar o cartão."} Seu espaço já está pronto; você pode cadastrar o cartão depois em Assinatura.`);
        setBusy(false);
        return;
      }
    }
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
          <h1 className={styles.title}>Seu espaço</h1>
          <TextField label="Nome do espaço" name="businessName" value={businessName} maxLength={80} onChange={(event) => setBusinessName(event.target.value)} error={errors.businessName} />
          <ChipGroup label="Quantos alunos você atende?" showLabel variant="card" tone="accent" columns={2} value={range} onChange={setRange} options={STUDENT_RANGE_OPTIONS} />
          {errors.range ? <p role="alert" className={styles.muted}>{errors.range}</p> : null}
          <TextField label="Celular" name="phone" type="tel" autoComplete="tel" placeholder="(11) 91234-5678" value={phone} onChange={(event) => setPhone(formatBrazilianPhone(event.target.value))} error={errors.phone} />
          <TextField label="CREF (opcional)" name="cref" value={cref} maxLength={20} onChange={(event) => setCref(event.target.value)} />
        </div>
      ) : null}

      {step === 2 ? (
        <div className={styles.form}>
          <h1 className={styles.title}>Seu plano</h1>
          <p className={styles.lead}>Sugerimos pelo que você contou. Dá para trocar depois.</p>
          <div className={styles.cards} role="radiogroup" aria-label="Planos">
            {plans.map((entry) => (
              <button key={entry.id} type="button" role="radio" aria-checked={plan?.id === entry.id} className={plan?.id === entry.id ? `${styles.card} ${styles.cardOn}` : styles.card} onClick={() => setPlanId(entry.id)}>
                <span className={styles.cardText}>
                  <span className={styles.cardTitle}>
                    {entry.name} {suggested?.id === entry.id ? <Tag tone="accent">Sugerido</Tag> : null}
                  </span>
                  <span className={styles.muted}>
                    {formatCentsBRL(entry.priceCents)} / {entry.billingCycle === "ANUAL" ? "ano" : "mês"} · {entry.studentLimit === null ? "alunos sem limite" : `até ${entry.studentLimit} alunos`}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className={styles.form}>
          <h1 className={styles.title}>Pagamento</h1>
          <p className={styles.lead}>{paid ? `Nada é cobrado agora. A primeira cobrança de ${formatCentsBRL(plan!.priceCents)} é em ${dateFmt.format(firstCharge)}, depois dos ${trialDays} dias grátis.` : "Este plano não tem cobrança."}</p>
          <TextField label="CPF ou CNPJ" name="cpfCnpj" inputMode="numeric" value={cpfCnpj} onChange={(event) => setCpfCnpj(formatCpfCnpj(event.target.value))} error={errors.cpfCnpj} />
          {paid ? <CreditCardFields value={{ ...card, phone }} onChange={(value) => setCard(value)} errors={cardErrors} hidePhone /> : null}
        </div>
      ) : null}

      {step === 4 && plan ? (
        <div className={styles.form}>
          <h1 className={styles.title}>Tudo certo?</h1>
          <dl className={styles.cards}>
            <div className={styles.card}>
              <span className={styles.cardText}>
                <dt className={styles.muted}>Espaço</dt>
                <dd className={styles.cardTitle}>{businessName}</dd>
                <dd className={styles.muted}>
                  {range ? studentRangeLabel(range) : ""} · {phone}
                  {cref ? ` · CREF ${cref}` : ""}
                </dd>
              </span>
            </div>
            <div className={styles.card}>
              <span className={styles.cardText}>
                <dt className={styles.muted}>Plano</dt>
                <dd className={styles.cardTitle}>{plan.name}</dd>
                <dd className={styles.muted}>{paid ? `${trialDays} dias grátis · primeira cobrança em ${dateFmt.format(firstCharge)}` : "Sem cobrança"}</dd>
              </span>
            </div>
          </dl>
          <Button type="button" size="xl" block disabled={busy} onClick={() => void finish()}>
            {busy ? "Preparando…" : paid ? `Começar meus ${trialDays} dias grátis` : "Começar"}
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
