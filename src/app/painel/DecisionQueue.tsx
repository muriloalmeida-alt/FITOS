"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, Button, Tag, useToast, type TagTone } from "@/shared/ui";
import { formatCentsBRL } from "@/shared/lib/money";
import type { PersonalFeedItem, PersonalFeedKind } from "@/modules/students/personalFeed";
import styles from "./DecisionQueue.module.css";

const KIND_TAG: Record<PersonalFeedKind, { label: string; tone: TagTone }> = {
  cobranca_atrasada: { label: "Cobrança", tone: "error" },
  convite_expirado: { label: "Convite", tone: "warn" },
  convite_aceito: { label: "Novo", tone: "ok" },
  sem_programa: { label: "Sem programa", tone: "warn" },
  programa_terminando: { label: "Programa", tone: "warn" },
  treino_concluido: { label: "Treinou", tone: "ok" },
  avaliacao_pendente: { label: "Avaliação", tone: "muted" },
};

function first(name: string) {
  return name.trim().split(/\s+/)[0] ?? name;
}

function question(item: PersonalFeedItem): string {
  const name = first(item.studentName);
  switch (item.kind) {
    case "cobranca_atrasada":
      return `${name} pagou ${item.amountCents ? formatCentsBRL(item.amountCents) : "a mensalidade"}?`;
    case "convite_expirado":
      return `Mandar um convite novo para ${name}?`;
    case "convite_aceito":
      return `${name} chegou. Qual programa?`;
    case "sem_programa":
      return `${name} está sem programa.`;
    case "programa_terminando":
      return `Repetir o programa de ${name}?`;
    case "treino_concluido":
      return `${name} treinou.`;
    case "avaliacao_pendente":
      return `Hora de avaliar ${name}?`;
  }
}

async function post(url: string): Promise<Response> {
  return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
}

/// Início do personal como fila (EPIC-29): uma decisão por vez, já com a
/// ação mais provável. Resolver com um toque ou deixar para depois; o que
/// é feito aqui mostra Desfazer quando dá para desfazer.
export function DecisionQueue({ items, total }: { items: PersonalFeedItem[]; total: number }) {
  const router = useRouter();
  const toast = useToast();
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const item = items[index] ?? null;
  const next = items[index + 1] ?? null;
  const advance = () => {
    setError(null);
    setIndex((current) => current + 1);
  };

  async function act(run: () => Promise<boolean>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const ok = await run().catch(() => false);
    setBusy(false);
    if (ok) advance();
    else setError("Não deu certo agora. Tente de novo.");
  }

  function primary(current: PersonalFeedItem) {
    const name = first(current.studentName);
    switch (current.kind) {
      case "cobranca_atrasada":
        return (
          <Button type="button" block disabled={busy} onClick={() => void act(async () => {
            const ids = current.chargeIds ?? [];
            const results = await Promise.all(ids.map((id) => post(`/api/cobrancas/${id}/recebi`)));
            if (results.some((response) => !response.ok)) return false;
            toast.show(`${current.amountCents ? formatCentsBRL(current.amountCents) : "Pagamento"} de ${name} recebido`, {
              label: "Desfazer",
              onClick: () => void Promise.all(ids.map((id) => post(`/api/cobrancas/${id}/desfazer-pagamento`))).then(() => router.refresh()),
            });
            return true;
          })}>
            Recebi
          </Button>
        );
      case "convite_expirado":
        return (
          <Button type="button" block disabled={busy} onClick={() => void act(async () => {
            const response = await post(`/api/students/${current.studentId}/convite`);
            if (!response.ok) return false;
            const { link } = (await response.json()) as { link: string };
            await navigator.clipboard?.writeText(link).catch(() => undefined);
            toast.show(`Convite novo de ${name} copiado. Cole na conversa.`);
            return true;
          })}>
            Gerar e copiar o link
          </Button>
        );
      case "programa_terminando":
        return (
          <Button type="button" block disabled={busy} onClick={() => void act(async () => {
            const response = await post(`/api/students/${current.studentId}/copia/repetir`);
            if (!response.ok) return false;
            toast.show(`Programa de ${name} repetido a partir de hoje`);
            return true;
          })}>
            Repetir
          </Button>
        );
      default:
        return (
          <Button href={current.href} block>
            {current.actionLabel}
          </Button>
        );
    }
  }

  function secondary(current: PersonalFeedItem) {
    if (current.kind === "cobranca_atrasada") {
      const text = `Oi, ${first(current.studentName)}! Passando para lembrar da mensalidade${current.amountCents ? ` de ${formatCentsBRL(current.amountCents)}` : ""}. Qualquer coisa, me avisa.`;
      return (
        <Button href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer" variant="secondary" block onClick={advance}>
          Lembrar
        </Button>
      );
    }
    if (current.kind === "programa_terminando") {
      return (
        <Button href={current.href} variant="secondary" block>
          Escolher outro
        </Button>
      );
    }
    return (
      <Button type="button" variant="secondary" block onClick={advance}>
        Depois
      </Button>
    );
  }

  return (
    <section className={styles.queue} aria-labelledby="fila-titulo">
      <div className={styles.head}>
        <h2 id="fila-titulo" className={styles.title}>
          Pede você agora
        </h2>
        {items.length > 0 ? (
          <span className={styles.count}>
            {Math.min(index, items.length)} de {items.length}
          </span>
        ) : null}
      </div>
      {items.length > 0 ? (
        <div className={styles.bar} aria-hidden="true">
          {items.map((entry, position) => (
            <span key={`${entry.kind}-${entry.studentId}`} className={position < index ? styles.barOn : undefined} />
          ))}
        </div>
      ) : null}

      {item ? (
        <>
          <article className={styles.card} aria-live="polite">
            <div className={styles.who}>
              <Avatar name={item.studentName} />
              <span>
                <span className={styles.name}>{item.studentName}</span>{" "}
                <Tag tone={KIND_TAG[item.kind].tone}>{KIND_TAG[item.kind].label}</Tag>
              </span>
            </div>
            <p className={styles.what}>{question(item)}</p>
            <p className={styles.why}>{item.description}</p>
            {error ? <p className={styles.error}>{error}</p> : null}
            <div className={styles.actions}>
              {primary(item)}
              {secondary(item)}
            </div>
          </article>
          {next ? (
            <p className={styles.peek}>
              Depois: <strong>{next.studentName}</strong> · {next.description}
            </p>
          ) : null}
        </>
      ) : (
        <div className={styles.done}>
          <p className={styles.doneTitle}>Tudo em dia.</p>
          <p className={styles.why}>{items.length > 0 ? "Você passou pela fila toda." : "Nada pede você agora."}</p>
          {total > items.length ? (
            <Button href="/painel/alunos?filtro=atencao" variant="secondary" block>
              Ver os outros {total - items.length}
            </Button>
          ) : items.length > 0 ? (
            <Button type="button" variant="quiet" block onClick={() => { setIndex(0); router.refresh(); }}>
              Ver de novo
            </Button>
          ) : null}
        </div>
      )}
    </section>
  );
}
