"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, FormAlert, TextField } from "@/shared/ui";
import { STUDENT_OBJECTIVES } from "@/shared/lib/studentObjectives";
import { PasswordField } from "../../_entrada/PasswordField";
import { rememberAccount } from "../../_entrada/rememberedAccount";
import { usePush } from "../../painel/_push/usePush";
import { InstallGuide } from "../../painel/_push/InstallGuide";
import styles from "../../_entrada/Entrada.module.css";

type Hero =
  | { kind: "today"; workoutName: string; exercises: number; estimatedMinutes: number }
  | { kind: "progress"; workoutName: string }
  | { kind: "rest"; next: { dayLabel: string; workoutName: string } | null }
  | { kind: "noPlan" };

/// Entrar pelo convite (EPIC-33, E5): conta (nome, e-mail, senha), o
/// objetivo num toque e o treino de hoje — "Começar agora" sem passar por
/// mais nenhuma tela. Lembrete de treino em um toque.
export function JoinByLinkForm({ code, personalFirstName, businessName }: { code: string; personalFirstName: string; businessName: string }) {
  const router = useRouter();
  const push = usePush();
  const [step, setStep] = useState<"conta" | "objetivo" | "pronto">("conta");
  const [guide, setGuide] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hero, setHero] = useState<Hero | null>(null);
  const [reminder, setReminder] = useState<"off" | "on" | "fail">("off");
  const first = name.trim().split(/\s+/)[0] ?? "";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const found: Record<string, string> = {};
    if (name.trim().length < 2) found.name = "Informe seu nome.";
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) found.email = "Informe um e-mail válido.";
    if (password.length < 8) found.password = "Use pelo menos 8 caracteres.";
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    setFormError(null);
    const response = await fetch(`/api/convite-link/${code}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), email: email.trim(), password }) });
    setBusy(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setFormError(body?.error === "EMAIL_JA_POSSUI_CONTA" ? "Este e-mail já tem conta. Entre com ele e cole o convite no Início." : (body?.message ?? "Não foi possível entrar. Tente de novo."));
      return;
    }
    rememberAccount({ name: name.trim(), email: email.trim().toLowerCase(), role: "ALUNO" });
    setStep("objetivo");
  }

  async function pickObjective(objective: string) {
    setBusy(true);
    await fetch("/api/meu-objetivo", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ objective }) }).catch(() => undefined);
    const today = (await fetch("/api/meu-inicio").then((r) => r.json()).catch(() => null)) as { hero?: Hero } | null;
    setHero(today?.hero ?? { kind: "noPlan" });
    setBusy(false);
    setStep("pronto");
  }

  async function remind() {
    if (push.state === "install") {
      setGuide(true);
      return;
    }
    try {
      if (push.state !== "on" && !(await push.enable())) {
        setReminder("fail");
        return;
      }
      const response = await fetch("/api/minhas-notificacoes", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reminderHour: 7 }) });
      setReminder(response.ok ? "on" : "fail");
    } catch {
      setReminder("fail");
    }
  }

  if (step === "objetivo") {
    return (
      <div className={styles.form}>
        <h1 className={styles.title}>Qual é o seu objetivo?</h1>
        <div className={styles.options} role="radiogroup" aria-label="Seu objetivo">
          {STUDENT_OBJECTIVES.map((objective) => (
            <button key={objective} type="button" role="radio" aria-checked={false} className={styles.option} disabled={busy} onClick={() => void pickObjective(objective)}>
              <span className={styles.optionText}>
                <span className={styles.optionTitle}>{objective}</span>
              </span>
              <span className={styles.chev} aria-hidden="true">›</span>
            </button>
          ))}
        </div>
        <p className={styles.muted}>{personalFirstName} vê sua resposta e ajusta o treino.</p>
      </div>
    );
  }

  if (step === "pronto") {
    return (
      <div className={styles.form}>
        <h1 className={styles.title}>Tudo certo, {first}</h1>
        {hero?.kind === "today" || hero?.kind === "progress" ? (
          <div className={styles.action}>
            <span className={styles.actionKicker}>Seu treino de hoje</span>
            <span className={styles.actionTitle}>{hero.workoutName}</span>
            {hero.kind === "today" ? (
              <span className={styles.muted}>
                {hero.exercises} {hero.exercises === 1 ? "exercício" : "exercícios"} · cerca de {hero.estimatedMinutes} min
              </span>
            ) : null}
            <Button href="/painel/treino/sessao" size="lg" block>
              Começar agora
            </Button>
          </div>
        ) : hero?.kind === "rest" ? (
          <div className={styles.action}>
            <span className={styles.actionKicker}>Hoje é descanso</span>
            <span className={styles.actionTitle}>{hero.next ? `${hero.next.dayLabel}: ${hero.next.workoutName}` : "Seu programa está pronto"}</span>
          </div>
        ) : (
          <p className={styles.hint}>
            {personalFirstName} vai montar seu treino em {businessName}. Avisamos quando chegar.
          </p>
        )}
        {push.state === "unsupported" || push.state === "unavailable" ? null : (
          <Button type="button" variant="secondary" block disabled={reminder === "on"} onClick={() => void remind()}>
            {reminder === "on" ? "Lembrete ligado: dias de treino, às 7h" : "Me lembrar nos dias de treino"}
          </Button>
        )}
        {reminder === "fail" ? <p className={styles.muted}>Sem permissão para avisar. Você pode ligar depois no Perfil.</p> : null}
        <InstallGuide open={guide} onClose={() => setGuide(false)} />
        <Button
          type="button"
          variant="quiet"
          block
          onClick={() => {
            router.push("/painel");
            router.refresh();
          }}
        >
          Ver meu Início
        </Button>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <h1 className={styles.title}>Treinar com {personalFirstName}</h1>
      {formError ? <FormAlert variant="error">{formError}</FormAlert> : null}
      <TextField label="Seu nome" name="name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} error={errors.name} disabled={busy} />
      <TextField label="E-mail" name="email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} error={errors.email} disabled={busy} />
      <PasswordField label="Crie uma senha" value={password} onChange={setPassword} error={errors.password} autoComplete="new-password" disabled={busy} />
      <Button type="submit" size="lg" block disabled={busy}>
        {busy ? "Entrando…" : `Entrar em ${businessName}`}
      </Button>
      <p className={styles.muted}>O FitOS não cobra você. Mensalidade é com {personalFirstName}.</p>
    </form>
  );
}
