"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { ExperienceLevel, IndividualObjective, WeeklyAvailability } from "@prisma/client";
import { Button, FormAlert, SelectField } from "@/shared/ui";
import styles from "./OnboardingForm.module.css";

interface OnboardingFormProps {
  initialObjective: IndividualObjective | null;
  initialExperienceLevel: ExperienceLevel | null;
  initialWeeklyAvailability: WeeklyAvailability | null;
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
}

export function OnboardingForm({ initialObjective, initialExperienceLevel, initialWeeklyAvailability }: OnboardingFormProps) {
  const router = useRouter();
  const [objective, setObjective] = useState<IndividualObjective | "">(initialObjective ?? "");
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel | "">(initialExperienceLevel ?? "");
  const [weeklyAvailability, setWeeklyAvailability] = useState<WeeklyAvailability | "">(initialWeeklyAvailability ?? "");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    const errors: FieldErrors = {};
    if (!objective) errors.objective = "Escolha um objetivo.";
    if (!experienceLevel) errors.experienceLevel = "Escolha seu nível de experiência.";
    if (!weeklyAvailability) errors.weeklyAvailability = "Escolha sua disponibilidade.";
    setFieldErrors(errors);
    setFormError(null);

    if (Object.keys(errors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    const response = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objective, experienceLevel, weeklyAvailability }),
    });
    setIsSubmitting(false);

    if (!response.ok) {
      setFormError("Não foi possível salvar suas respostas. Verifique e tente novamente.");
      return;
    }

    router.push("/painel");
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {formError ? <FormAlert variant="error">{formError}</FormAlert> : null}

      <SelectField
        label="Qual seu objetivo principal?"
        name="objective"
        placeholder="Selecione um objetivo"
        options={OBJECTIVE_OPTIONS}
        value={objective}
        onChange={(event) => setObjective(event.target.value as IndividualObjective)}
        error={fieldErrors.objective}
        disabled={isSubmitting}
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
        disabled={isSubmitting}
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
        disabled={isSubmitting}
        required
      />

      <Button type="submit" variant="filled" disabled={isSubmitting}>
        {isSubmitting ? "Salvando…" : "Concluir"}
      </Button>
    </form>
  );
}
