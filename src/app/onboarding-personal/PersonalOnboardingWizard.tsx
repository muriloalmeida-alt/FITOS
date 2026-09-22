"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { PersonalStudentRangeEstimate } from "@prisma/client";
import { Button, FormAlert, SelectField, TextField } from "@/shared/ui";
import { formatBrazilianPhone, isValidBrazilianPhone } from "@/shared/lib/brazilianPhone";
import styles from "./page.module.css";

interface PersonalOnboardingWizardProps {
  initialBusinessName: string;
}

const STUDENT_RANGE_OPTIONS: { value: PersonalStudentRangeEstimate; label: string }[] = [
  { value: "COMECANDO_AGORA", label: "Começando agora" },
  { value: "ATE_20", label: "Até 20 alunos" },
  { value: "DE_21_A_50", label: "De 21 a 50 alunos" },
  { value: "MAIS_DE_50", label: "Mais de 50 alunos" },
];

function studentRangeLabel(value: PersonalStudentRangeEstimate | ""): string {
  return STUDENT_RANGE_OPTIONS.find((option) => option.value === value)?.label ?? "—";
}

type Step = 1 | 2 | 3;

interface FieldErrors {
  phone?: string;
  cref?: string;
  studentRangeEstimate?: string;
  businessName?: string;
  termsAccepted?: string;
}

/// Onboarding profissional do Personal (FIT-113, seção 7 do pacote). Três
/// sub-etapas dentro de uma única rota real (`/onboarding-personal`) —
/// diferente da decisão de caminho da FIT-112 (que precisava de URLs
/// próprias, por ser bookmarkable/compartilhável entre três produtos
/// diferentes), aqui é um único fluxo linear de uma sessão, mesmo padrão
/// de qualquer formulário de múltiplos passos: estado de cliente é
/// suficiente, a rota em si já é a "URL navegável" que a seção 6 do
/// pacote pede.
///
/// "Nome do espaço/negócio" nunca é um campo novo — grava direto em
/// `Tenant.name` (já existe desde a FIT-010), nunca uma coluna duplicada.
/// "Data de nascimento" (mencionada na seção 7 do pacote) foi
/// deliberadamente omitida: nenhuma funcionalidade atual do FitOS usa essa
/// informação para o Personal, e o próprio pacote só pede o campo "se
/// houver justificativa funcional no modelo atual" — não há.
export function PersonalOnboardingWizard({ initialBusinessName }: PersonalOnboardingWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [phone, setPhone] = useState("");
  const [cref, setCref] = useState("");
  const [studentRangeEstimate, setStudentRangeEstimate] = useState<PersonalStudentRangeEstimate | "">("");
  const [businessName, setBusinessName] = useState(initialBusinessName);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasData = phone.trim() !== "" || cref.trim() !== "" || studentRangeEstimate !== "" || businessName.trim() !== initialBusinessName.trim();

  /// Requisito comum do onboarding (seção 6 do pacote, aplicado aqui por
  /// ser a mesma família de fluxo da FIT-112): fechar a aba/navegar para
  /// fora do site com dados preenchidos pede confirmação nativa do
  /// navegador.
  useEffect(() => {
    if (!hasData || isSubmitting) {
      return;
    }
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasData, isSubmitting]);

  function goToStep2(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors: FieldErrors = {};
    if (!isValidBrazilianPhone(phone)) {
      errors.phone = "Informe um celular válido, com DDD.";
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    setStep(2);
  }

  function goToStep3(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors: FieldErrors = {};
    if (!studentRangeEstimate) {
      errors.studentRangeEstimate = "Escolha uma faixa de alunos.";
    }
    if (businessName.trim().length === 0) {
      errors.businessName = "Informe o nome do seu espaço/negócio.";
    }
    if (!termsAccepted) {
      errors.termsAccepted = "É necessário aceitar os termos para continuar.";
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    setStep(3);
  }

  async function handleSubmit() {
    if (isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    setFormError(null);

    const response = await fetch("/api/onboarding-personal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone,
        cref: cref.trim() || undefined,
        studentRangeEstimate,
        businessName,
        termsAccepted,
      }),
    });

    if (!response.ok) {
      setIsSubmitting(false);
      setFormError("Não foi possível salvar seu perfil. Verifique os dados e tente novamente.");
      return;
    }

    const body = await response.json();
    router.push(body.redirectTo ?? "/painel");
  }

  return (
    <>
      <p className={styles.stepIndicator}>Passo {step} de 3</p>

      {step === 1 ? (
        <form className={styles.form} onSubmit={goToStep2} noValidate>
          <h1 className={styles.title}>Dados complementares</h1>
          {formError ? <FormAlert variant="error">{formError}</FormAlert> : null}

          <TextField
            label="Celular"
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder="(11) 91234-5678"
            value={phone}
            onChange={(event) => setPhone(formatBrazilianPhone(event.target.value))}
            error={fieldErrors.phone}
            required
          />
          <TextField
            label="CREF (opcional)"
            name="cref"
            type="text"
            autoComplete="off"
            placeholder="012345-G/SP"
            value={cref}
            onChange={(event) => setCref(event.target.value)}
            error={fieldErrors.cref}
          />

          <Button type="submit" variant="filled">
            Continuar
          </Button>
        </form>
      ) : null}

      {step === 2 ? (
        <form className={styles.form} onSubmit={goToStep3} noValidate>
          <h1 className={styles.title}>Perfil profissional</h1>
          {formError ? <FormAlert variant="error">{formError}</FormAlert> : null}

          <SelectField
            label="Quantos alunos você tem hoje, aproximadamente?"
            name="studentRangeEstimate"
            placeholder="Selecione uma faixa"
            options={STUDENT_RANGE_OPTIONS}
            value={studentRangeEstimate}
            onChange={(event) => setStudentRangeEstimate(event.target.value as PersonalStudentRangeEstimate)}
            error={fieldErrors.studentRangeEstimate}
            required
          />
          <TextField
            label="Nome do seu espaço/negócio"
            name="businessName"
            type="text"
            autoComplete="off"
            value={businessName}
            onChange={(event) => setBusinessName(event.target.value)}
            error={fieldErrors.businessName}
            required
          />

          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(event) => setTermsAccepted(event.target.checked)}
            />
            Li e aceito os Termos de Uso e a Política de Privacidade.
          </label>
          <p className={styles.termsPending}>Termos de uso e Política de Privacidade — em preparação.</p>
          {fieldErrors.termsAccepted ? (
            <p className={styles.checkboxError} role="alert">
              {fieldErrors.termsAccepted}
            </p>
          ) : null}

          <div className={styles.actions}>
            <button type="button" className={styles.backButton} onClick={() => setStep(1)}>
              ← Voltar
            </button>
            <Button type="submit" variant="filled">
              Continuar
            </Button>
          </div>
        </form>
      ) : null}

      {step === 3 ? (
        <div className={styles.form}>
          <h1 className={styles.title}>Revisão</h1>
          {formError ? <FormAlert variant="error">{formError}</FormAlert> : null}

          <dl className={styles.reviewList}>
            <dt>Perfil</dt>
            <dd>Personal</dd>
            <dt>Celular</dt>
            <dd>{phone}</dd>
            {cref.trim() ? (
              <>
                <dt>CREF</dt>
                <dd>{cref}</dd>
              </>
            ) : null}
            <dt>Faixa de alunos</dt>
            <dd>{studentRangeLabel(studentRangeEstimate)}</dd>
            <dt>Nome do espaço/negócio</dt>
            <dd>{businessName}</dd>
          </dl>

          <div className={styles.actions}>
            <button type="button" className={styles.backButton} onClick={() => setStep(2)} disabled={isSubmitting}>
              ← Voltar
            </button>
            <Button type="button" variant="filled" onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Concluindo…" : "Concluir"}
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
