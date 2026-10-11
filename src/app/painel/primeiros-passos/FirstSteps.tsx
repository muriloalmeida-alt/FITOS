"use client";

import { useEffect, useState } from "react";
import { Button, FormAlert } from "@/shared/ui";
import { formatCentsBRL } from "@/shared/lib/money";
import type { InviteDefaults } from "@/modules/students/inviteLink";
import styles from "./FirstSteps.module.css";

const SENT_KEY = "fitos:primeiro-convite";
const PRICES = [12000, 15000, 18000, 20000];

interface Props {
  url: string;
  personalFirstName: string;
  hasStudents: boolean;
  programs: { id: string; name: string; meta: string }[];
  defaults: InviteDefaults;
}

async function save(body: Record<string, unknown>): Promise<InviteDefaults> {
  const response = await fetch("/api/students/convite-link", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await response.json().catch(() => null)) as (InviteDefaults & { message?: string }) | null;
  if (!response.ok || !data) throw new Error(data?.message ?? "Não foi possível salvar.");
  return data;
}

function Check({ done }: { done: boolean }) {
  return (
    <span className={done ? `${styles.check} ${styles.checkOn}` : styles.check} aria-hidden="true">
      {done ? "✓" : ""}
    </span>
  );
}

/// Três ações do primeiro aluno (EPIC-33, E4), uma em destaque por vez.
/// O programa e a mensalidade escolhidos aqui valem para todo mundo que
/// entrar pelo link (aplicados sozinhos na entrada).
export function FirstSteps({ url, personalFirstName, hasStudents, programs, defaults: initial }: Props) {
  const [sent, setSent] = useState(hasStudents);
  const [defaults, setDefaults] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- lê o aparelho depois da hidratação
      if (window.localStorage.getItem(SENT_KEY) === url) setSent(true);
    } catch {
      // Sem armazenamento: o passo continua em aberto.
    }
  }, [url]);

  function markSent() {
    setSent(true);
    try {
      window.localStorage.setItem(SENT_KEY, url);
    } catch {
      // Ignora.
    }
  }

  async function run(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      setDefaults(await save(body));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    await navigator.clipboard?.writeText(url).catch(() => undefined);
    markSent();
  }

  const done = [sent, Boolean(defaults.programId), Boolean(defaults.feeCents)];
  const count = done.filter(Boolean).length;
  const current = done.indexOf(false);
  const message = `Oi! Entra no meu FitOS por aqui, o seu treino já está lá: ${url}`;
  const box = (index: number) => (current === index ? `${styles.step} ${styles.stepNow}` : styles.step);

  return (
    <div className={styles.page}>
      <div>
        <div className={styles.bar} aria-hidden="true">
          {done.map((value, index) => (
            <span key={index} data-on={String(value)} />
          ))}
        </div>
        <p className={styles.muted} aria-live="polite">
          {count === 3 ? "Tudo pronto. Quando o aluno abrir o link, o treino e a mensalidade já estão lá." : `${count} de 3 · leva menos de um minuto`}
        </p>
      </div>

      {error ? <FormAlert>{error}</FormAlert> : null}

      <section className={box(0)} aria-label="Mandar o convite">
        <div className={styles.head}>
          <Check done={sent} />
          <div>
            <p className={styles.title}>Mandar o convite</p>
            <p className={styles.muted}>{sent ? "Enviado. O aluno preenche nome, e-mail e objetivo." : "O aluno preenche nome, e-mail e objetivo."}</p>
          </div>
        </div>
        {current === 0 || !sent ? (
          <div className={styles.actions}>
            <Button href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer" onClick={markSent}>
              WhatsApp
            </Button>
            <Button type="button" variant="secondary" onClick={() => void copy()}>
              Copiar link
            </Button>
          </div>
        ) : null}
      </section>

      <section className={box(1)} aria-label="Escolher o programa">
        <div className={styles.head}>
          <Check done={Boolean(defaults.programId)} />
          <div>
            <p className={styles.title}>Escolher o programa</p>
            <p className={styles.muted}>{defaults.programName ? `${defaults.programName} · vai junto com o convite` : "Quem entrar pelo link já recebe a própria cópia."}</p>
          </div>
        </div>
        {current === 1 ? (
          <div className={styles.options} role="radiogroup" aria-label="Programas">
            {programs.map((program) => (
              <button key={program.id} type="button" role="radio" aria-checked={defaults.programId === program.id} className={styles.option} disabled={busy} onClick={() => void run({ programId: program.id })}>
                <span className={styles.title}>{program.name}</span>
                <span className={styles.muted}>{program.meta}</span>
              </button>
            ))}
          </div>
        ) : defaults.programId ? (
          <button type="button" className={styles.change} onClick={() => void run({ programId: null })}>
            Trocar
          </button>
        ) : null}
      </section>

      <section className={box(2)} aria-label="Combinar a mensalidade">
        <div className={styles.head}>
          <Check done={Boolean(defaults.feeCents)} />
          <div>
            <p className={styles.title}>Combinar a mensalidade</p>
            <p className={styles.muted}>{defaults.feeCents ? `${formatCentsBRL(defaults.feeCents)} todo dia ${defaults.feeDay ?? 10}` : "Um toque no valor. O mês se gera sozinho."}</p>
          </div>
        </div>
        {current === 2 ? (
          <div className={styles.chips} role="radiogroup" aria-label="Valor da mensalidade">
            {PRICES.map((cents) => (
              <button key={cents} type="button" role="radio" aria-checked={defaults.feeCents === cents} className={styles.chip} disabled={busy} onClick={() => void run({ feeCents: cents, feeDay: 10 })}>
                {formatCentsBRL(cents).replace(/,00$/, "")}
              </button>
            ))}
          </div>
        ) : defaults.feeCents ? (
          <button type="button" className={styles.change} onClick={() => void run({ feeCents: null, feeDay: null })}>
            Trocar
          </button>
        ) : null}
      </section>

      {count === 3 ? (
        <Button href="/painel" size="lg" block>
          Ir para o Início
        </Button>
      ) : (
        <Button href="/painel" variant="quiet" block>
          Fazer depois
        </Button>
      )}
      <p className={styles.muted}>CREF, celular e dados do negócio ficam no Perfil, para quando você quiser, {personalFirstName}.</p>
    </div>
  );
}
