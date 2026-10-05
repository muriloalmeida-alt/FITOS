"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PersonalStudentRangeEstimate } from "@prisma/client";
import { Button, FormAlert, TextField } from "@/shared/ui";
import { signUp } from "@/modules/identity/auth-client";
import { formatCentsBRL } from "@/shared/lib/money";
import { suggestPlan } from "@/modules/billing/suggestPlan";
import { PasswordField } from "../_entrada/PasswordField";
import { rememberAccount } from "../_entrada/rememberedAccount";
import styles from "../_entrada/Entrada.module.css";

export interface StartPlan {
  id: string;
  name: string;
  priceCents: number;
  studentLimit: number | null;
}

const RANGES: { value: PersonalStudentRangeEstimate; label: string; short: string }[] = [
  { value: "COMECANDO_AGORA", label: "Estou começando", short: "quem está começando" },
  { value: "ATE_20", label: "Até 20 alunos", short: "até 20 alunos" },
  { value: "DE_21_A_50", label: "21 a 50 alunos", short: "21 a 50 alunos" },
  { value: "MAIS_DE_50", label: "Mais de 50", short: "mais de 50 alunos" },
];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function finishOnboarding(range: PersonalStudentRangeEstimate, businessName?: string): Promise<string> {
  const response = await fetch("/api/onboarding-personal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ studentRangeEstimate: range, businessName }),
  });
  const body = (await response.json().catch(() => null)) as { redirectTo?: string; message?: string } | null;
  if (!response.ok) throw new Error(body?.message ?? "Não foi possível criar seu espaço.");
  return body?.redirectTo ?? "/painel/primeiros-passos";
}

/// Começar como personal (EPIC-33, E3): uma pergunta de um toque (quantos
/// alunos, que já mostra o plano sugerido) e a conta com três campos. O
/// nome do espaço vem sugerido. Sem CPF, celular nem cartão: o teste de 30
/// dias começa na hora. Já logado (cadastro antigo incompleto), só a
/// pergunta.
export function PersonalComecar({ plans, signedIn = false }: { plans: StartPlan[]; signedIn?: boolean }) {
  const router = useRouter();
  const [range, setRange] = useState<PersonalStudentRangeEstimate | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [space, setSpace] = useState<string | null>(null);
  const [editingSpace, setEditingSpace] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const first = name.trim().split(/\s+/)[0] || "";
  const spaceName = space ?? (first ? `Studio ${first}` : "Seu espaço");
  const picked = RANGES.find((entry) => entry.value === range);
  const plan = suggestPlan(plans, range);

  async function pick(value: PersonalStudentRangeEstimate) {
    setRange(value);
    if (!signedIn) return;
    setBusy(true);
    try {
      router.push(await finishOnboarding(value));
      router.refresh();
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : "Não foi possível criar seu espaço.");
      setBusy(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !range) return;
    const normalized = email.trim().toLowerCase();
    const found: typeof errors = {};
    if (name.trim().length < 2) found.name = "Informe seu nome.";
    if (!EMAIL.test(normalized)) found.email = "Informe um e-mail válido.";
    if (password.length < 8) found.password = "Use pelo menos 8 caracteres.";
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    const { error } = await signUp.email({ name: name.trim(), email: normalized, password, role: "PERSONAL" });
    if (error) {
      setBusy(false);
      setFormError("Não foi possível criar a conta. Se você já tem conta com este e-mail, entre por aqui.");
      return;
    }
    rememberAccount({ name: name.trim(), email: normalized, role: "PERSONAL" });
    try {
      router.push(await finishOnboarding(range, spaceName === "Seu espaço" ? undefined : spaceName));
      router.refresh();
    } catch {
      // A conta existe; o onboarding pode ser retomado em /onboarding-personal.
      router.push("/onboarding-personal");
    }
  }

  const onAccount = range !== null && !signedIn;

  return (
    <>
      <div className={styles.stepsRow}>
        <div className={styles.steps} style={{ flex: 1 }} aria-hidden="true">
          <span data-on="true" />
          {signedIn ? null : <span data-on={String(onAccount)} />}
        </div>
        <span>{signedIn ? "1 de 1" : onAccount ? "2 de 2" : "1 de 2"}</span>
      </div>
      {formError ? (
        <FormAlert variant="error">
          {formError} {formError.includes("entre por aqui") ? <Link href="/entrar">Entrar</Link> : null}
        </FormAlert>
      ) : null}

      {!onAccount ? (
        <>
          <h1 className={styles.title}>Quantos alunos hoje?</h1>
          <div className={styles.options} role="radiogroup" aria-label="Quantos alunos você atende">
            {RANGES.map((entry) => {
              const suggestion = suggestPlan(plans, entry.value);
              return (
                <button key={entry.value} type="button" role="radio" aria-checked={range === entry.value} className={range === entry.value ? `${styles.option} ${styles.optionOn}` : styles.option} disabled={busy} onClick={() => void pick(entry.value)}>
                  <span className={styles.optionText}>
                    <span className={styles.optionTitle}>{entry.label}</span>
                    {suggestion ? <span className={styles.muted}>{suggestion.priceCents > 0 ? `${suggestion.name} · ${formatCentsBRL(suggestion.priceCents)} por mês` : suggestion.name}</span> : null}
                  </span>
                  <span className={styles.chev} aria-hidden="true">›</span>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <form className={styles.form} onSubmit={submit} noValidate>
          <h1 className={styles.title}>Crie seu espaço</h1>
          <TextField label="Seu nome" name="name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} error={errors.name} disabled={busy} required />
          <TextField label="E-mail" name="email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} error={errors.email} disabled={busy} required />
          <PasswordField value={password} onChange={setPassword} error={errors.password} autoComplete="new-password" disabled={busy} />
          {editingSpace ? (
            <TextField label="Nome do espaço" name="space" value={spaceName === "Seu espaço" ? "" : spaceName} maxLength={80} autoFocus onChange={(event) => setSpace(event.target.value)} onBlur={() => setEditingSpace(false)} />
          ) : (
            <p className={styles.muted}>
              Seu espaço:{" "}
              <button type="button" className={styles.pill} aria-label={`Nome do espaço: ${spaceName}. Tocar para mudar`} onClick={() => setEditingSpace(true)}>
                {spaceName}
              </button>
            </p>
          )}
          <Button type="submit" size="lg" block disabled={busy}>
            {busy ? "Criando…" : "Criar meu espaço"}
          </Button>
          <p className={styles.hint}>
            30 dias grátis, sem cartão.{plan ? ` Perto do fim do teste, sugerimos o ${plan.name} para ${picked?.short ?? "você"}.` : ""}
          </p>
          <p className={styles.muted}>
            Ao criar sua conta você aceita os <Link href="/termos-de-uso">Termos de uso</Link> e a <Link href="/politica-de-privacidade">Política de privacidade</Link>.
          </p>
          <Button type="button" variant="quiet" block onClick={() => setRange(null)}>
            Voltar
          </Button>
        </form>
      )}
    </>
  );
}
