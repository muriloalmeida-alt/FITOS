"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ExperienceLevel, IndividualObjective, WeeklyAvailability } from "@prisma/client";
import { Button, FormAlert, TextField, useToast } from "@/shared/ui";
import { signUp } from "@/modules/identity/auth-client";
import { formatCentsBRL } from "@/shared/lib/money";
import { WEEKDAYS } from "@/shared/lib/weekdays";
import { PasswordField } from "../_entrada/PasswordField";
import { rememberAccount } from "../_entrada/rememberedAccount";
import styles from "../_entrada/Entrada.module.css";

type Answers = { objective: IndividualObjective | null; availability: WeeklyAvailability | null; experience: ExperienceLevel | null };
type Preview = { name: string; days: string[]; exercises: number; minutes: number }[];

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

function days(keys: string[]) {
  return WEEKDAYS.filter((day) => keys.includes(day.key)).map((day) => day.short.toLowerCase()).join(" e ");
}

/// FitOS Livre (EPIC-33, L1 + E6): três toques montam o plano e a pessoa
/// vê os treinos antes de qualquer cadastro. A conta vem depois ("salve
/// seu plano"), sem CPF nem cartão: o teste grátis começa na hora. Já
/// logado (cadastro antigo incompleto), "Começar hoje" conclui direto.
export function LivreComecar({ signedIn = false, priceCents = null, trialDays = 30 }: { signedIn?: boolean; priceCents?: number | null; trialDays?: number | null }) {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({ objective: null, availability: null, experience: null });
  const [preview, setPreview] = useState<Preview | null>(null);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const question = QUESTIONS[step];
  const ready = step >= QUESTIONS.length;

  useEffect(() => {
    if (!ready || !answers.objective || !answers.availability || !answers.experience) return;
    const query = new URLSearchParams({ objetivo: answers.objective, dias: answers.availability, experiencia: answers.experience });
    let cancelled = false;
    void fetch(`/api/livre/previa?${query}`)
      .then((response) => response.json())
      .then((body: { workouts?: Preview }) => {
        if (!cancelled) setPreview(body.workouts ?? []);
      })
      .catch(() => {
        if (!cancelled) setPreview([]);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, answers]);

  function pick(value: string) {
    if (!question) return;
    setAnswers((current) => ({ ...current, [question.key]: value }));
    setPreview(null);
    setStep(step + 1);
  }

  async function finish(): Promise<boolean> {
    const response = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objective: answers.objective, experienceLevel: answers.experience, weeklyAvailability: answers.availability }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { message?: string } | null;
      setFormError(body?.message ?? "Não foi possível montar seu plano. Tente de novo.");
      return false;
    }
    toast.show("Seu plano está pronto");
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
    setFormError(null);
    if (Object.keys(found).length > 0) return;
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

  return (
    <>
      <div className={styles.stepsRow}>
        <div className={styles.steps} style={{ flex: 1 }} aria-hidden="true">
          {QUESTIONS.map((entry, index) => (
            <span key={entry.key} data-on={String(index <= step)} />
          ))}
        </div>
        <span>{ready ? "Pronto" : `${step + 1} de 3`}</span>
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
      ) : (
        <>
          <h1 className={styles.title}>Seu plano chegou</h1>
          {preview === null ? (
            <p className={styles.muted} aria-live="polite">Montando…</p>
          ) : (
            <ul className={styles.options} aria-label="Seus treinos" style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {preview.map((workout) => (
                <li key={workout.name} className={styles.option} style={{ cursor: "default" }}>
                  <span className={styles.optionText}>
                    <span className={styles.optionTitle}>{workout.name}</span>
                    <span className={styles.muted}>
                      {[days(workout.days), `cerca de ${workout.minutes} min`].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {formError ? (
            <FormAlert variant="error">
              {formError} {formError.includes("entre por aqui") ? <Link href="/entrar">Entrar</Link> : null}
            </FormAlert>
          ) : null}

          {signedIn ? (
            <Button type="button" size="lg" block disabled={busy || preview === null} onClick={() => void startSignedIn()}>
              {busy ? "Montando…" : "Começar hoje"}
            </Button>
          ) : saving ? (
            <form className={styles.form} onSubmit={submit} noValidate aria-label="Salve seu plano">
              <h2 className={styles.title} style={{ fontSize: 20 }}>Salve seu plano</h2>
              <TextField label="Seu nome" name="name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} error={errors.name} disabled={busy} required />
              <TextField label="E-mail" name="email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} error={errors.email} disabled={busy} required />
              <PasswordField label="Crie uma senha" value={password} onChange={setPassword} error={errors.password} autoComplete="new-password" disabled={busy} />
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
              <Button type="button" size="lg" block disabled={preview === null} onClick={() => setSaving(true)}>
                Salvar e começar
              </Button>
              <p className={styles.hint}>{trial}</p>
            </>
          )}
          <Button type="button" variant="quiet" block onClick={() => setStep(QUESTIONS.length - 1)}>
            Mudar respostas
          </Button>
        </>
      )}
    </>
  );
}
