"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Sheet, useToast } from "@/shared/ui";
import { formatCentsBRL } from "@/shared/lib/money";
import styles from "./QuickActions.module.css";

export interface QuickCharge {
  id: string;
  studentName: string;
  amountCents: number;
  overdue: boolean;
}

interface Props {
  charges: QuickCharge[];
  students: { id: string; name: string }[];
}

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/// Entende "recebi 180 do Bruno": a cobrança aberta do aluno citado (ou a
/// única aberta) e o valor, se veio um número.
export function parseReceive(text: string, charges: QuickCharge[]): QuickCharge | null {
  const query = normalize(text);
  if (!/receb|pag|pix/.test(query)) return null;
  const named = charges.filter((charge) => normalize(charge.studentName).split(/\s+/).some((part) => part.length > 2 && query.includes(part)));
  const pool = named.length > 0 ? named : charges.length === 1 ? charges : [];
  const amount = /(\d+(?:[.,]\d{1,2})?)/.exec(query);
  if (amount) {
    const cents = Math.round(Number(amount[1]!.replace(",", ".")) * 100);
    return pool.find((charge) => charge.amountCents === cents) ?? pool[0] ?? null;
  }
  return pool[0] ?? null;
}

/// Botão + do Início (EPIC-29): diga o que quer fazer. As ações mais usadas
/// em um toque e "recebi 180 do Bruno" vira um cartão para confirmar.
export function QuickActions({ charges, students }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"menu" | "receber" | "avaliar">("menu");
  const [busy, setBusy] = useState(false);
  const parsed = useMemo(() => parseReceive(query, charges), [query, charges]);

  function close() {
    setOpen(false);
    setQuery("");
    setMode("menu");
  }

  async function receive(charge: QuickCharge) {
    setBusy(true);
    const response = await fetch(`/api/cobrancas/${charge.id}/recebi`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    setBusy(false);
    if (!response.ok) {
      toast.show("Não foi possível registrar. Tente de novo.");
      return;
    }
    toast.show(`${formatCentsBRL(charge.amountCents)} de ${charge.studentName.split(/\s+/)[0]} recebidos`, {
      label: "Desfazer",
      onClick: () => void fetch(`/api/cobrancas/${charge.id}/desfazer-pagamento`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).then(() => router.refresh()),
    });
    close();
    router.refresh();
  }

  const overdue = charges.filter((charge) => charge.overdue);

  return (
    <>
      <button type="button" className={styles.fab} onClick={() => setOpen(true)} aria-label="Fazer algo">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
      <Sheet open={open} onClose={close} title="O que vamos fazer?">
        <div className={styles.body}>
          <label className={styles.search}>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ex.: recebi 180 do Bruno" aria-label="O que vamos fazer?" />
          </label>

          {parsed ? (
            <div className={styles.parsed}>
              <p className={styles.parsedText}>
                Marcar <strong>{formatCentsBRL(parsed.amountCents)}</strong> de <strong>{parsed.studentName}</strong> como recebido, hoje.
              </p>
              <Button type="button" block disabled={busy} onClick={() => void receive(parsed)}>
                Confirmar
              </Button>
            </div>
          ) : null}

          {mode === "receber" ? (
            <ul className={styles.list} aria-label="Cobranças em aberto">
              {charges.length === 0 ? <li className={styles.muted}>Nenhuma cobrança em aberto.</li> : null}
              {charges.map((charge) => (
                <li key={charge.id} className={styles.row}>
                  <span>
                    <strong>{charge.studentName}</strong>
                    <span className={styles.muted}> · {formatCentsBRL(charge.amountCents)}{charge.overdue ? " · atrasada" : ""}</span>
                  </span>
                  <Button type="button" disabled={busy} onClick={() => void receive(charge)}>
                    Recebi
                  </Button>
                </li>
              ))}
            </ul>
          ) : mode === "avaliar" ? (
            <ul className={styles.list} aria-label="Avaliar quem?">
              {students.map((student) => (
                <li key={student.id}>
                  <Button href={`/painel/alunos/${student.id}/avaliacao`} variant="secondary" block onClick={close}>
                    {student.name}
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <ul className={styles.list} aria-label="Mais usados">
              <li>
                <button type="button" className={styles.action} onClick={() => setMode("receber")}>
                  <strong>Receber pagamento</strong>
                  <span className={styles.muted}>{overdue.length > 0 ? `${overdue.length} ${overdue.length === 1 ? "atrasada" : "atrasadas"}` : `${charges.length} em aberto`}</span>
                </button>
              </li>
              <li>
                <Button href="/painel/alunos/convite" variant="secondary" block onClick={close}>
                  Convidar aluno
                </Button>
              </li>
              <li>
                <Button href="/painel/treinos" variant="secondary" block onClick={close}>
                  Dar um programa
                </Button>
              </li>
              <li>
                <button type="button" className={styles.action} onClick={() => setMode("avaliar")}>
                  <strong>Registrar avaliação</strong>
                  <span className={styles.muted}>Peso e medidas em segundos</span>
                </button>
              </li>
              <li>
                <Button href="/painel/treinos/novo" variant="secondary" block onClick={close}>
                  Montar treino
                </Button>
              </li>
              <li>
                <Button href="/painel/financeiro?nova=1" variant="secondary" block onClick={close}>
                  Cobrança avulsa
                </Button>
              </li>
            </ul>
          )}
        </div>
      </Sheet>
    </>
  );
}
