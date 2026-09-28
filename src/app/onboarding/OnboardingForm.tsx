"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ExperienceLevel, IndividualObjective, WeeklyAvailability } from "@prisma/client";
import { Button, FormAlert, PlanOptionCard, SelectField, TextField, WizardProgress, useUnsavedChangesGuard, type PlanOptionCardPlan } from "@/shared/ui";
import { formatCpfCnpj, isValidCpfCnpj } from "@/shared/lib/cpfCnpj";
import styles from "./OnboardingForm.module.css";

interface OnboardingFormProps {
  initialObjective: IndividualObjective | null;
  initialExperienceLevel: ExperienceLevel | null;
  initialWeeklyAvailability: WeeklyAvailability | null;
  /// CPF/CNPJ já informado numa conclusão anterior (FIT-128, Issue #153)
  /// — `null` para perfis concluídos antes deste campo existir.
  initialCpfCnpj: string | null;
  /// Já aceitou os termos numa conclusão anterior (FIT-119) — reabrir o
  /// onboarding para ajustar objetivo/experiência/disponibilidade nunca
  /// exige um novo aceite; o checkbox aparece pré-marcado e desabilitado
  /// nesse caso, nunca escondido (o aceite continua visível/honesto).
  alreadyAcceptedTerms: boolean;
  /// Catálogo real do FitOS Livre (FIT-126/FIT-127), nunca uma lista fixa
  /// na interface — vem do servidor (`listActivePlansForAudience`). Hoje
  /// tende a ter só um plano (`individual-livre-v2`), mas a tela nunca
  /// assume isso: se o backend um dia oferecer mais de um produto para o
  /// FitOS Livre, o mesmo passo já lista todos.
  plans: PlanOptionCardPlan[];
  /// Plano já contratado, se este onboarding está sendo reaberto.
  initialPlanId: string | null;
}

const OBJECTIVE_OPTIONS: { value: IndividualObjective; label: string }[] = [
  { value: "GANHAR_MASSA", label: "Ganhar massa muscular" },
  { value: "PERDER_PESO", label: "Perder peso" },
  { value: "CONDICIONAMENTO_GERAL", label: "Condicionamento geral" },
  { value: "SAUDE_E_BEM_ESTAR", label: "Saúde e bem-estar" },
  { value: "OUTRO", label: "Outro" },
];

const EXPERIENCE_OPTIONS: { value: ExperienceLevel; label: string }[] = [
  { value: "INICIANTE", label: "Iniciante" },
  { value: "INTERMEDIARIO", label: "Intermediário" },
  { value: "AVANCADO", label: "Avançado" },
];

const AVAILABILITY_OPTIONS: { value: WeeklyAvailability; label: string }[] = [
  { value: "UM_A_DOIS_DIAS", label: "1 a 2 dias por semana" },
  { value: "TRES_A_QUATRO_DIAS", label: "3 a 4 dias por semana" },
  { value: "CINCO_OU_MAIS_DIAS", label: "5 dias ou mais por semana" },
];

interface FieldErrors {
  objective?: string;
  experienceLevel?: string;
  weeklyAvailability?: string;
  cpfCnpj?: string;
  planId?: string;
  termsAccepted?: string;
}

const TOTAL_STEPS = 2;

/// Onboarding do FitOS Livre (FIT-101/FIT-126) — duas sub-etapas dentro de
/// uma única rota real (`/onboarding`), mesmo padrão de
/// `PersonalOnboardingWizard`: "Preferências" (objetivo, experiência,
/// disponibilidade) e "Plano e conclusão" (seleção do plano real do
/// catálogo + aceite dos termos). Antes desta História era um único
/// formulário sem nenhuma etapa de plano — a contratação do FitOS Livre
/// nunca existia dentro do próprio onboarding, era só uma configuração de
/// preferências (FIT-101).
///
/// **CPF/CNPJ na Etapa 1 (FIT-128, Issue #153)**: obrigatório desde que o
/// Asaas exige `cpfCnpj` para criar um cliente real (`POST /v3/customers`)
/// — decisão de Murilo de estender o mesmo tratamento de
/// `PersonalOnboardingWizard` ao FitOS Livre, já que `individual-livre-v2`
/// também é um plano pago real.
export function OnboardingForm({
  initialObjective,
  initialExperienceLevel,
  initialWeeklyAvailability,
  initialCpfCnpj,
  alreadyAcceptedTerms,
  plans,
  initialPlanId,
}: OnboardingFormProps) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [objective, setObjective] = useState<IndividualObjective | "">(initialObjective ?? "");
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel | "">(initialExperienceLevel ?? "");
  const [weeklyAvailability, setWeeklyAvailability] = useState<WeeklyAvailability | "">(initialWeeklyAvailability ?? "");
  const [cpfCnpj, setCpfCnpj] = useState(initialCpfCnpj ?? "");
  const [planId, setPlanId] = useState(initialPlanId ?? "");
  const [termsAccepted, setTermsAccepted] = useState(alreadyAcceptedTerms);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasData =
    objective !== (initialObjective ?? "") ||
    experienceLevel !== (initialExperienceLevel ?? "") ||
    weeklyAvailability !== (initialWeeklyAvailability ?? "") ||
    cpfCnpj !== (initialCpfCnpj ?? "") ||
    planId !== (initialPlanId ?? "");

  useUnsavedChangesGuard(hasData, isSubmitting);

  function goToStep2(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors: FieldErrors = {};
    if (!objective) errors.objective = "Escolha um objetivo.";
    if (!experienceLevel) errors.experienceLevel = "Escolha seu nível de experiência.";
    if (!weeklyAvailability) errors.weeklyAvailability = "Escolha sua disponibilidade.";
    if (!isValidCpfCnpj(cpfCnpj)) errors.cpfCnpj = "Informe um CPF ou CNPJ válido.";
    setFieldErrors(errors);
    setFormError(null);
    if (Object.keys(errors).length > 0) {
      return;
    }
    setStep(2);
  }

  function selectPlan(id: string) {
    setPlanId(id);
    setFieldErrors((current) => ({ ...current, planId: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    const errors: FieldErrors = {};
    if (!planId) errors.planId = "Escolha um plano para continuar.";
    if (!alreadyAcceptedTerms && !termsAccepted) errors.termsAccepted = "É necessário aceitar os termos para continuar.";
    setFieldErrors(errors);
    setFormError(null);

    if (Object.keys(errors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    const response = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objective, experienceLevel, weeklyAvailability, cpfCnpj, termsAccepted, planId }),
    });
    setIsSubmitting(false);

    if (!response.ok) {
      setFormError("Não foi possível salvar suas respostas. Verifique e tente novamente.");
      return;
    }

    router.push("/painel");
  }

  return (
    <>
      <WizardProgress step={step} totalSteps={TOTAL_STEPS} />

      {step === 1 ? (
        <form className={styles.form} onSubmit={goToStep2} noValidate>
          {formError ? <FormAlert variant="error">{formError}</FormAlert> : null}

          <SelectField
            label="Qual seu objetivo principal?"
            name="objective"
            placeholder="Selecione um objetivo"
            options={OBJECTIVE_OPTIONS}
            value={objective}
            onChange={(event) => setObjective(event.target.value as IndividualObjective)}
            error={fieldErrors.objective}
            required
          />
          <SelectField
            label="Qual sua experiência com treino?"
            name="experienceLevel"
            placeholder="Selecione um nível"
            options={EXPERIENCE_OPTIONS}
            value={experienceLevel}
            onChange={(event) => setExperienceLevel(event.target.value as ExperienceLevel)}
            error={fieldErrors.experienceLevel}
            required
          />
          <SelectField
            label="Quantos dias por semana você pode treinar?"
            name="weeklyAvailability"
            placeholder="Selecione uma disponibilidade"
            options={AVAILABILITY_OPTIONS}
            value={weeklyAvailability}
            onChange={(event) => setWeeklyAvailability(event.target.value as WeeklyAvailability)}
            error={fieldErrors.weeklyAvailability}
            required
          />
          <TextField
            label="CPF ou CNPJ"
            name="cpfCnpj"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="000.000.000-00"
            value={cpfCnpj}
            onChange={(event) => setCpfCnpj(formatCpfCnpj(event.target.value))}
            error={fieldErrors.cpfCnpj}
            required
          />

          <Button type="submit" variant="filled">
            Continuar
          </Button>
        </form>
      ) : null}

      {step === 2 ? (
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          {formError ? <FormAlert variant="error">{formError}</FormAlert> : null}
          <p className={styles.checkboxLabel}>Todos os planos têm 30 dias grátis antes da primeira cobrança.</p>

          <div className={styles.planList}>
            {plans.map((plan) => (
              <PlanOptionCard
                key={plan.id}
                plan={plan}
                groupName="planId"
                selected={planId === plan.id}
                onSelect={() => selectPlan(plan.id)}
                showStudentLimit={false}
                disabled={isSubmitting}
              />
            ))}
          </div>
          {fieldErrors.planId ? (
            <p className={styles.checkboxError} role="alert">
              {fieldErrors.planId}
            </p>
          ) : null}

          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(event) => setTermsAccepted(event.target.checked)}
              disabled={isSubmitting || alreadyAcceptedTerms}
            />
            Li e aceito os <Link href="/termos-de-uso">Termos de Uso</Link> e a{" "}
            <Link href="/politica-de-privacidade">Política de Privacidade</Link>.
          </label>
          {fieldErrors.termsAccepted ? (
            <p className={styles.checkboxError} role="alert">
              {fieldErrors.termsAccepted}
            </p>
          ) : null}

          <div className={styles.actions}>
            <button type="button" className={styles.backButton} onClick={() => setStep(1)} disabled={isSubmitting}>
              ← Voltar
            </button>
            <Button type="submit" variant="filled" disabled={isSubmitting}>
              {isSubmitting ? "Salvando…" : "Concluir"}
            </Button>
          </div>
        </form>
      ) : null}
    </>
  );
}
