"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ExperienceLevel, IndividualObjective, WeeklyAvailability } from "@prisma/client";
import { Button, FormAlert, TextField, useToast } from "@/shared/ui";
import { SignupCouponField, couponNotice, type SignupCoupon } from "./SignupCouponField";
import { signUp } from "@/modules/identity/auth-client";
import { formatCentsBRL } from "@/shared/lib/money";
import { modalitiesLabel, type Modality } from "@/shared/lib/modalities";
import type { ProgramChoice, Recommendations } from "@/modules/library/recommendationTypes";
import { PasswordField } from "../_entrada/PasswordField";
import { rememberAccount } from "../_entrada/rememberedAccount";
import { ModalityPicker } from "../_modalidades/ModalityPicker";
import { ProgramRecommendations } from "../_modalidades/ProgramRecommendations";
import styles from "../_entrada/Entrada.module.css";

type Answers = { objective: IndividualObjective | null; availability: WeeklyAvailability | null; experience: ExperienceLevel | null };

/// Respostas guardadas nesta aba: voltar ou recarregar não perde nada.
const DRAFT_KEY = "fitos:livre-respostas";
type Draft = { step: number; answers: Answers; modalities: Modality[] };

function readDraft(): Draft | null {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

function writeDraft(draft: Draft | null) {
  try {
    if (draft) window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    else window.sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // Sem armazenamento: segue só em memória.
  }
}

const QUESTIONS = [
  {
    key: "objective" as const,
    title: "O que você quer?",
    options: [
      { value: "GANHAR_MASSA", label: "Ganhar massa", hint: "Mais carga, menos repetições" },
      { value: "PERDER_PESO", label: "Emagrecer", hint: "Musculação e aeróbico" },
      { value: "SAUDE_E_BEM_ESTAR", label: "Saúde e disposição", hint: "Corpo todo, equilibrado" },
      { value: "CONDICIONAMENTO_GERAL", label: "Condicionamento", hint: "Fôlego e força" },
    ],
  },
  {
    key: "availability" as const,
    title: "Quantos dias?",
    options: [
      { value: "UM_A_DOIS_DIAS", label: "1 a 2 dias por semana", hint: "Corpo todo em cada um" },
      { value: "TRES_A_QUATRO_DIAS", label: "3 a 4 dias por semana", hint: "Treinos alternados" },
      { value: "CINCO_OU_MAIS_DIAS", label: "5 ou mais", hint: "Divisão por grupo e aeróbico" },
    ],
  },
  {
    key: "experience" as const,
    title: "Você já treina?",
    options: [
      { value: "INICIANTE", label: "Estou começando", hint: "Máquinas e cargas leves" },
      { value: "INTERMEDIARIO", label: "Treino há meses", hint: "Pesos livres e máquinas" },
      { value: "AVANCADO", label: "Treino há anos", hint: "Volume maior" },
    ],
  },
];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/// FitOS Livre (EPIC-33, L1 + E6; proposta 11): três toques e as
/// modalidades, depois os programas prontos compatíveis — a pessoa escolhe
/// um (vê os detalhes e confirma) ou decide depois. A conta vem em seguida
/// ("salve seu plano"), sem CPF nem cartão. Já logado (cadastro antigo
/// incompleto), conclui direto.
export function LivreComecar({ signedIn = false, priceCents = null, trialDays = 30, initialModalities = [], allowCoupon = false }: { signedIn?: boolean; priceCents?: number | null; trialDays?: number | null; initialModalities?: Modality[]; allowCoupon?: boolean }) {
  const [coupon, setCoupon] = useState<SignupCoupon | null>(null);
  const [couponPending, setCouponPending] = useState(false);
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({ objective: null, availability: null, experience: null });
  const [modalities, setModalities] = useState<Modality[]>(initialModalities);
  const [recommendations, setRecommendations] = useState<Recommendations | null>(null);
  const [choice, setChoice] = useState<ProgramChoice | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const question = QUESTIONS[step];
  const MODALITY_STEP = QUESTIONS.length;
  const ready = step > MODALITY_STEP;

  // Retomar: as respostas desta aba voltam depois de recarregar.
  useEffect(() => {
    const draft = readDraft();
    if (!draft) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restaura uma vez, depois da hidratação (o sessionStorage não existe no servidor)
    setAnswers(draft.answers);
    if (draft.modalities.length > 0) setModalities(draft.modalities);
    setStep(Math.min(draft.step, MODALITY_STEP + 1));
  }, [MODALITY_STEP]);

  useEffect(() => {
    writeDraft({ step, answers, modalities });
  }, [step, answers, modalities]);

  useEffect(() => {
    if (!ready || !answers.objective || !answers.availability || !answers.experience || modalities.length === 0) return;
    const query = new URLSearchParams({ objetivo: answers.objective, dias: answers.availability, experiencia: answers.experience });
    for (const modality of modalities) query.append("modalidade", modality);
    let cancelled = false;
    void fetch(`/api/livre/recomendacoes?${query}`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("falha"))))
      .then((body: Recommendations) => {
        if (!cancelled) setRecommendations(body);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, answers, modalities, attempt]);

  function pick(value: string) {
    if (!question) return;
    setAnswers((current) => ({ ...current, [question.key]: value }));
    setRecommendations(null);
    setChoice(undefined);
    setStep(step + 1);
  }

  function toRecommendations() {
    setRecommendations(null);
    setLoadError(false);
    setChoice(undefined);
    setStep(MODALITY_STEP + 1);
  }

  async function finish(): Promise<boolean> {
    const response = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objective: answers.objective, experienceLevel: answers.experience, weeklyAvailability: answers.availability, modalities, program: choice ?? null, ...(coupon ? { couponCode: coupon.code } : {}) }),
    }).catch(() => null);
    if (!response?.ok) {
      // As escolhas ficam; dá para tentar de novo.
      const body = (await response?.json().catch(() => null)) as { message?: string } | null;
      setFormError(body?.message ?? "Não foi possível salvar suas preferências. Tente de novo.");
      return false;
    }
    writeDraft(null);
    const saved = (await response.json().catch(() => null)) as { coupon?: { applied: boolean; message?: string } | null } | null;
    const notice = couponNotice(saved?.coupon);
    toast.show(notice ?? (saved?.coupon?.applied ? "Conta criada com o seu cupom de desconto" : choice ? "Seu plano está pronto" : "Preferências salvas"));
    router.push("/painel");
    router.refresh();
    return true;
  }

  async function startSignedIn() {
    setBusy(true);
    if (!(await finish())) setBusy(false);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const normalized = email.trim().toLowerCase();
    const found: typeof errors = {};
    if (name.trim().length < 2) found.name = "Informe seu nome.";
    if (!EMAIL.test(normalized)) found.email = "Informe um e-mail válido.";
    if (password.length < 8) found.password = "Use pelo menos 8 caracteres.";
    setErrors(found);
    setFormError(couponPending ? "Toque em Aplicar para conferir o cupom, ou apague o código." : null);
    if (Object.keys(found).length > 0 || couponPending) return;
    setBusy(true);
    const { error } = await signUp.email({ name: name.trim(), email: normalized, password, role: "INDIVIDUAL" });
    if (error) {
      setBusy(false);
      setFormError("Não foi possível criar a conta. Se você já tem conta com este e-mail, entre por aqui.");
      return;
    }
    rememberAccount({ name: name.trim(), email: normalized, role: "INDIVIDUAL" });
    if (!(await finish())) {
      router.push("/onboarding");
    }
  }

  const trial = `${trialDays ?? 30} dias grátis, sem cartão.${priceCents ? ` Perto do fim, você escolhe continuar por ${formatCentsBRL(priceCents)} por mês.` : ""}`;

  const chosenName = choice ? recommendations?.groups.flatMap((group) => group.options).find((option) => option.choice.kind === choice.kind && (choice.kind === "inicial" || (option.choice.kind === "programa" && option.choice.key === choice.key)))?.name : null;
  const total = QUESTIONS.length + 1;

  return (
    <>
      <div className={styles.stepsRow}>
        <div className={styles.steps} style={{ flex: 1 }} aria-hidden="true">
          {Array.from({ length: total }, (_, index) => (
            <span key={index} data-on={String(index <= step)} />
          ))}
        </div>
        <span>{ready ? "Pronto" : `${step + 1} de ${total}`}</span>
      </div>

      {question ? (
        <>
          <h1 className={styles.title}>{question.title}</h1>
          <div className={styles.options} role="radiogroup" aria-label={question.title}>
            {question.options.map((option) => (
              <button key={option.value} type="button" role="radio" aria-checked={answers[question.key] === option.value} className={answers[question.key] === option.value ? `${styles.option} ${styles.optionOn}` : styles.option} onClick={() => pick(option.value)}>
                <span className={styles.optionText}>
                  <span className={styles.optionTitle}>{option.label}</span>
                  <span className={styles.muted}>{option.hint}</span>
                </span>
                <span className={styles.chev} aria-hidden="true">›</span>
              </button>
            ))}
          </div>
          {step > 0 ? (
            <Button type="button" variant="quiet" block onClick={() => setStep(step - 1)}>
              Voltar
            </Button>
          ) : null}
        </>
      ) : step === MODALITY_STEP ? (
        <>
          <p className={styles.kicker}>Seu jeito de treinar</p>
          <h1 className={styles.title}>Quais modalidades você quer praticar?</h1>
          <p className={styles.muted}>Escolha uma ou mais opções.</p>
          <ModalityPicker value={modalities} onChange={setModalities} />
          <Button type="button" size="lg" block disabled={modalities.length === 0} onClick={toRecommendations}>
            Continuar
          </Button>
          <Button type="button" variant="quiet" block onClick={() => setStep(step - 1)}>
            Voltar
          </Button>
        </>
      ) : (
        <>
          <p className={styles.kicker}>Seu jeito de treinar</p>
          <h1 className={styles.title}>Programas para você</h1>
          <p className={styles.muted}>{modalitiesLabel(modalities)}. Escolha como quer começar.</p>
          {loadError ? (
            <FormAlert variant="error">
              Não foi possível carregar os programas.{" "}
              <button type="button" className={styles.linkButton} onClick={() => { setLoadError(false); setAttempt(attempt + 1); }}>
                Tentar de novo
              </button>
            </FormAlert>
          ) : recommendations === null ? (
            <p className={styles.muted} aria-live="polite">Buscando programas…</p>
          ) : (
            <ProgramRecommendations data={recommendations} selected={choice} onSelect={setChoice} onAdjust={() => setStep(MODALITY_STEP)} />
          )}
          <p className={styles.muted}>{chosenName ? `Escolhido: ${chosenName}.` : "Você pode decidir depois."}</p>
          {formError ? (
            <FormAlert variant="error">
              {formError} {formError.includes("entre por aqui") ? <Link href="/entrar">Entrar</Link> : null}
            </FormAlert>
          ) : null}

          {signedIn ? (
            <Button type="button" size="lg" block disabled={busy || recommendations === null} onClick={() => void startSignedIn()}>
              {busy ? "Salvando…" : choice ? "Começar hoje" : "Ir para o painel"}
            </Button>
          ) : saving ? (
            <form className={styles.form} onSubmit={submit} noValidate aria-label="Salve seu plano">
              <h2 className={styles.title} style={{ fontSize: 20 }}>Salve seu plano</h2>
              <TextField label="Seu nome" name="name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} error={errors.name} disabled={busy} required />
              <TextField label="E-mail" name="email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} error={errors.email} disabled={busy} required />
              <PasswordField label="Crie uma senha" value={password} onChange={setPassword} error={errors.password} autoComplete="new-password" disabled={busy} />
              {allowCoupon ? <SignupCouponField product="INDIVIDUAL" value={coupon} onChange={setCoupon} onPendingChange={setCouponPending} disabled={busy} /> : null}
              <Button type="submit" size="lg" block disabled={busy}>
                {busy ? "Salvando…" : "Salvar e começar hoje"}
              </Button>
              <p className={styles.hint}>{trial}</p>
              <p className={styles.muted}>
                Ao criar sua conta você aceita os <Link href="/termos-de-uso">Termos de uso</Link> e a <Link href="/politica-de-privacidade">Política de privacidade</Link>.
              </p>
            </form>
          ) : (
            <>
              <Button type="button" size="lg" block disabled={recommendations === null && !loadError} onClick={() => setSaving(true)}>
                {choice ? "Salvar e começar" : "Salvar e ir para o painel"}
              </Button>
              <p className={styles.hint}>{trial}</p>
            </>
          )}
          <Button type="button" variant="quiet" block onClick={() => setStep(MODALITY_STEP)}>
            Mudar respostas
          </Button>
        </>
      )}
    </>
  );
}
