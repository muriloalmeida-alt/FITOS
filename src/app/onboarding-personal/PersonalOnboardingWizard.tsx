"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { PersonalStudentRangeEstimate } from "@prisma/client";
import {
  Button,
  CreditCardFields,
  EMPTY_CREDIT_CARD_FIELDS,
  FormAlert,
  PlanOptionCard,
  SelectField,
  TextField,
  WizardProgress,
  useUnsavedChangesGuard,
  validateCreditCardFields,
  type CreditCardFieldsValue,
  type PlanOptionCardPlan,
} from "@/shared/ui";
import { formatBrazilianPhone, isValidBrazilianPhone } from "@/shared/lib/brazilianPhone";
import { formatCpfCnpj, isValidCpfCnpj } from "@/shared/lib/cpfCnpj";
import { STUDENT_RANGE_OPTIONS, studentRangeLabel } from "@/modules/personal-onboarding/studentRangeLabel";
import { formatCentsBRL } from "@/shared/lib/money";
import styles from "./page.module.css";

interface PersonalOnboardingWizardProps {
  initialBusinessName: string;
  /// Catálogo real de planos do Personal (FIT-127), nunca uma lista fixa
  /// na interface — vem do servidor (`listActivePlansForAudience`).
  plans: PlanOptionCardPlan[];
  /// Plano já contratado, se este onboarding está sendo reaberto (reabrir
  /// nunca concede um novo trial — `subscribeTenantToPlan` já garante isso
  /// no servidor; aqui é só o valor pré-selecionado no passo 3).
  initialPlanId: string | null;
}

type Step = 1 | 2 | 3 | 4;

interface FieldErrors {
  phone?: string;
  cref?: string;
  cpfCnpj?: string;
  studentRangeEstimate?: string;
  businessName?: string;
  termsAccepted?: string;
  planId?: string;
}

type CardFieldErrors = Partial<Record<keyof CreditCardFieldsValue, string>>;

/// Onboarding profissional do Personal (FIT-113/FIT-126, seção 7 do
/// pacote). Quatro sub-etapas dentro de uma única rota real
/// (`/onboarding-personal`) — diferente da decisão de caminho da FIT-112
/// (que precisava de URLs próprias, por ser bookmarkable/compartilhável
/// entre três produtos diferentes), aqui é um único fluxo linear de uma
/// sessão, mesmo padrão de qualquer formulário de múltiplos passos: estado
/// de cliente é suficiente, a rota em si já é a "URL navegável" que a
/// seção 6 do pacote pede.
///
/// **Passo 1, CPF/CNPJ (FIT-128, Issue #153)**: obrigatório desde que o
/// Asaas exige `cpfCnpj` para criar um cliente real (`POST /v3/customers`)
/// — nenhum onboarding do FitOS coletava esse dado antes. Decisão de
/// Murilo: cabe em `PersonalProfile`, nunca em `IndividualProfile`, porque
/// quem paga a assinatura SaaS é sempre o personal.
///
/// "Nome do espaço/negócio" nunca é um campo novo — grava direto em
/// `Tenant.name` (já existe desde a FIT-010), nunca uma coluna duplicada.
/// "Data de nascimento" (mencionada na seção 7 do pacote) foi
/// deliberadamente omitida: nenhuma funcionalidade atual do FitOS usa essa
/// informação para o Personal, e o próprio pacote só pede o campo "se
/// houver justificativa funcional no modelo atual" — não há.
///
/// **Passo 3, seleção de plano (FIT-126)**: catálogo real (`plans`, vindo
/// do servidor — nunca fixo aqui), com trial de 30 dias já embutido no
/// disclosure de cada cartão. A submissão final chama `subscribeTenantToPlan`
/// (mesma função de `/painel/assinatura`, FIT-122) através de
/// `/api/onboarding-personal` — nunca duas fontes de verdade para
/// "contratar um plano".
///
/// **Passo 4, checkout embutido de cartão (FIT-128)**: decisão de Murilo —
/// "toda a transação deve ocorrer no FitOS, o Asaas deve ser o gateway; o
/// cliente deve completar 100% do processo de checkout" — nunca um
/// redirecionamento para uma página do Asaas. Só aparece quando o plano
/// escolhido tem preço real (`priceCents > 0`); um plano gratuito nunca
/// pede cartão. O cartão só é *tokenizado* agora (nunca cobrado de
/// imediato) — a cobrança real só ocorre quando o trial de 30 dias
/// termina, mesmo mecanismo de `nextDueDate` já existente. Enviado a
/// `/api/tenancy/minha-assinatura/cartao` só depois que o onboarding em
/// si (perfil + seleção de plano) já foi salvo com sucesso.
const TOTAL_STEPS = 4;

export function PersonalOnboardingWizard({ initialBusinessName, plans, initialPlanId }: PersonalOnboardingWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [phone, setPhone] = useState("");
  const [cref, setCref] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [studentRangeEstimate, setStudentRangeEstimate] = useState<PersonalStudentRangeEstimate | "">("");
  const [businessName, setBusinessName] = useState(initialBusinessName);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [planId, setPlanId] = useState(initialPlanId ?? "");
  const [card, setCard] = useState<CreditCardFieldsValue>(EMPTY_CREDIT_CARD_FIELDS);
  const [cardErrors, setCardErrors] = useState<CardFieldErrors>({});
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasData =
    phone.trim() !== "" ||
    cref.trim() !== "" ||
    cpfCnpj.trim() !== "" ||
    studentRangeEstimate !== "" ||
    businessName.trim() !== initialBusinessName.trim() ||
    planId !== (initialPlanId ?? "") ||
    Object.values(card).some((value) => value.trim() !== "");

  useUnsavedChangesGuard(hasData, isSubmitting);

  const selectedPlan = plans.find((plan) => plan.id === planId);

  function goToStep2(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors: FieldErrors = {};
    if (!isValidBrazilianPhone(phone)) {
      errors.phone = "Informe um celular válido, com DDD.";
    }
    if (!isValidCpfCnpj(cpfCnpj)) {
      errors.cpfCnpj = "Informe um CPF ou CNPJ válido.";
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

  function goToStep4(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors: FieldErrors = {};
    if (!planId) {
      errors.planId = "Escolha um plano para continuar.";
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    setStep(4);
  }

  function selectPlan(id: string) {
    setPlanId(id);
    setFieldErrors((current) => ({ ...current, planId: undefined }));
  }

  async function handleSubmit() {
    if (isSubmitting) {
      return;
    }

    const requiresCard = (selectedPlan?.priceCents ?? 0) > 0;
    if (requiresCard) {
      const errors = validateCreditCardFields(card);
      setCardErrors(errors);
      if (Object.keys(errors).length > 0) {
        return;
      }
    }

    setIsSubmitting(true);
    setFormError(null);

    const response = await fetch("/api/onboarding-personal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone,
        cref: cref.trim() || undefined,
        cpfCnpj,
        studentRangeEstimate,
        businessName,
        termsAccepted,
        planId,
      }),
    });

    if (!response.ok) {
      setIsSubmitting(false);
      setFormError("Não foi possível salvar seu perfil. Verifique os dados e tente novamente.");
      return;
    }

    const body = await response.json();

    if (requiresCard) {
      const cardResponse = await fetch("/api/tenancy/minha-assinatura/cartao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(card),
      });
      if (!cardResponse.ok) {
        setIsSubmitting(false);
        const cardBody = await cardResponse.json().catch(() => null);
        setFormError(cardBody?.message ?? "Não foi possível processar o cartão. Verifique os dados e tente novamente.");
        return;
      }
    }

    router.push(body.redirectTo ?? "/painel");
  }

  return (
    <>
      <WizardProgress step={step} totalSteps={TOTAL_STEPS} />

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
            Li e aceito os <Link href="/termos-de-uso">Termos de Uso</Link> e a{" "}
            <Link href="/politica-de-privacidade">Política de Privacidade</Link>.
          </label>
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
        <form className={styles.form} onSubmit={goToStep4} noValidate>
          <h1 className={styles.title}>Escolha seu plano</h1>
          {formError ? <FormAlert variant="error">{formError}</FormAlert> : null}
          <p className={styles.checkboxLabel}>Todos os planos têm 30 dias grátis antes da primeira cobrança.</p>

          <div className={styles.planList}>
            {plans.map((plan) => (
              <PlanOptionCard key={plan.id} plan={plan} groupName="planId" selected={planId === plan.id} onSelect={() => selectPlan(plan.id)} />
            ))}
          </div>
          {fieldErrors.planId ? (
            <p className={styles.checkboxError} role="alert">
              {fieldErrors.planId}
            </p>
          ) : null}

          <div className={styles.actions}>
            <button type="button" className={styles.backButton} onClick={() => setStep(2)}>
              ← Voltar
            </button>
            <Button type="submit" variant="filled">
              Continuar
            </Button>
          </div>
        </form>
      ) : null}

      {step === 4 ? (
        <div className={styles.form}>
          <h1 className={styles.title}>Revisão</h1>
          {formError ? <FormAlert variant="error">{formError}</FormAlert> : null}

          <dl className={styles.reviewList}>
            <dt>Perfil</dt>
            <dd>Personal</dd>
            <dt>Celular</dt>
            <dd>{phone}</dd>
            <dt>CPF/CNPJ</dt>
            <dd>{cpfCnpj}</dd>
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
            <dt>Plano</dt>
            <dd>
              {selectedPlan
                ? `${selectedPlan.name} — ${formatCentsBRL(selectedPlan.priceCents)}/mês${
                    selectedPlan.trialDays !== null ? ` (${selectedPlan.trialDays} dias grátis)` : ""
                  }`
                : "—"}
            </dd>
          </dl>

          {selectedPlan && selectedPlan.priceCents > 0 ? (
            <>
              <h2 className={styles.title}>Dados de pagamento</h2>
              <p className={styles.checkboxLabel}>
                Seu cartão só é cadastrado agora — a primeira cobrança acontece só depois dos{" "}
                {selectedPlan.trialDays ?? 30} dias grátis.
              </p>
              <CreditCardFields value={card} onChange={setCard} errors={cardErrors} />
            </>
          ) : null}

          <div className={styles.actions}>
            <button type="button" className={styles.backButton} onClick={() => setStep(3)} disabled={isSubmitting}>
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
