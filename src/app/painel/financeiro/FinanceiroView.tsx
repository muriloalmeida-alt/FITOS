"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ActionRow, Avatar, Button, ChipGroup, FormAlert, NextStepCard, SegmentedTabs, Sheet, Stepper, Switch, Tag, TextField, useToast, type TagTone } from "@/shared/ui";
import { formatCentsBRL } from "@/shared/lib/money";
import { requestJson } from "../_workout-builder/apiClient";
import styles from "./FinanceiroView.module.css";

export type ChargeStatus = "PENDENTE" | "ATRASADO" | "PAGO" | "CANCELADO";

export interface FinanceCharge {
  id: string;
  studentId: string;
  studentName: string;
  description: string;
  amountCents: number;
  dueDate: string;
  status: ChargeStatus;
  cancelReason: string | null;
  paidAt: string | null;
  paidCents: number | null;
  method: string | null;
}

export interface FinanceRecurrence {
  id: string;
  studentId: string;
  studentName: string;
  description: string;
  amountCents: number;
  dueDay: number;
  generatedThisMonth: boolean;
}

export type FinanceTab = "cobrancas" | "recorrentes";
type StatusFilter = "todas" | "atrasadas" | "avencer" | "pagas" | "canceladas";

interface FinanceiroViewProps {
  monthKey: string;
  monthLabel: string;
  summary: { recebidoCents: number; pendenteCents: number; atrasadoCents: number };
  charges: FinanceCharge[];
  recurrences: FinanceRecurrence[];
  students: { id: string; displayName: string }[];
  pendingRecurrences: number;
  tab: FinanceTab;
  startNew: boolean;
}

const METHODS = ["Pix", "Dinheiro", "Cartão", "Transferência"];
const CANCEL_REASONS = ["Aluno desistiu", "Lançada por engano", "Valor errado", "Bolsa ou cortesia", "Outro"];
const DESCRIPTIONS = ["Mensalidade", "Avaliação", "Aula avulsa", "Plano trimestral"];
const FILTERS: { key: StatusFilter; label: string; match: (charge: FinanceCharge) => boolean }[] = [
  { key: "todas", label: "Todas", match: () => true },
  { key: "atrasadas", label: "Atrasadas", match: (charge) => charge.status === "ATRASADO" },
  { key: "avencer", label: "A vencer", match: (charge) => charge.status === "PENDENTE" },
  { key: "pagas", label: "Pagas", match: (charge) => charge.status === "PAGO" },
  { key: "canceladas", label: "Canceladas", match: (charge) => charge.status === "CANCELADO" },
];
const STATUS_TAG: Record<ChargeStatus, { label: string; tone: TagTone }> = {
  ATRASADO: { label: "Atrasada", tone: "error" },
  PENDENTE: { label: "A vencer", tone: "muted" },
  PAGO: { label: "Paga", tone: "ok" },
  CANCELADO: { label: "Cancelada", tone: "muted" },
};

const dayMonth = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
const dayMonthLocal = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });

function parseReais(text: string): number {
  const normalized = text.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  return Number(normalized);
}

function reaisText(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function todayInput(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function chargeMeta(charge: FinanceCharge): string {
  if (charge.status === "PAGO" && charge.paidAt) return `${charge.description} · pago em ${dayMonthLocal.format(new Date(charge.paidAt))}${charge.method ? ` · ${charge.method}` : ""}`;
  if (charge.status === "CANCELADO") return `${charge.description}${charge.cancelReason ? ` · ${charge.cancelReason}` : ""}`;
  return `${charge.description} · vence ${dayMonth.format(new Date(charge.dueDate))}`;
}

/// Financeiro do Personal (FIT-148, P6 do protótipo): controle manual de
/// mensalidades sem formulário — troca de mês, resumo, "Recebi" e
/// "Cancelar" em sheets, "Gerar todas" (BK-09) e nova cobrança com
/// "Repetir todo mês" (BK-10).
export function FinanceiroView({ monthKey, monthLabel, summary, charges, recurrences, students, pendingRecurrences, tab, startNew }: FinanceiroViewProps) {
  const router = useRouter();
  const toast = useToast();
  const [filter, setFilter] = useState<StatusFilter>("todas");
  const [sheet, setSheet] = useState<null | "new" | "pay" | "cancel" | "end">(startNew ? "new" : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<FinanceCharge | null>(null);
  const [ending, setEnding] = useState<FinanceRecurrence | null>(null);
  // Recebi
  const [amount, setAmount] = useState("");
  const [when, setWhen] = useState<"hoje" | "ontem" | "outra">("hoje");
  const [otherDate, setOtherDate] = useState(todayInput());
  const [method, setMethod] = useState("Pix");
  // Cancelar
  const [reason, setReason] = useState<string | null>(null);
  const [otherReason, setOtherReason] = useState("");
  // Nova cobrança
  const [studentId, setStudentId] = useState<string | null>(null);
  const [newAmount, setNewAmount] = useState("");
  const [dueDay, setDueDay] = useState(10);
  const [description, setDescription] = useState("Mensalidade");
  const [repeat, setRepeat] = useState(true);

  const counts = useMemo(() => Object.fromEntries(FILTERS.map((item) => [item.key, charges.filter(item.match).length])) as Record<StatusFilter, number>, [charges]);
  const visible = charges.filter(FILTERS.find((item) => item.key === filter)!.match);
  const tabHref = (key: FinanceTab) => `/painel/financeiro?mes=${monthKey}${key === "recorrentes" ? "&aba=recorrentes" : ""}`;

  function close() {
    setSheet(null);
    setError(null);
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível concluir.");
    } finally {
      setBusy(false);
    }
  }

  function openPay(charge: FinanceCharge) {
    setSelected(charge);
    setAmount(reaisText(charge.amountCents));
    setWhen("hoje");
    setOtherDate(todayInput());
    setMethod("Pix");
    setError(null);
    setSheet("pay");
  }

  function openCancel() {
    setReason(null);
    setOtherReason("");
    setError(null);
    setSheet("cancel");
  }

  function paidAtIso(): string {
    if (when === "outra") return new Date(`${otherDate}T12:00:00`).toISOString();
    const date = new Date();
    if (when === "ontem") date.setDate(date.getDate() - 1);
    return date.toISOString();
  }

  return (
    <div className={styles.view}>
      <nav className={styles.month} aria-label="Competência">
        <Link href={`/painel/financeiro?mes=${shift(monthKey, -1)}${tab === "recorrentes" ? "&aba=recorrentes" : ""}`} className={styles.monthArrow} aria-label="Mês anterior">
          ‹
        </Link>
        <span className={styles.monthLabel}>{monthLabel}</span>
        <Link href={`/painel/financeiro?mes=${shift(monthKey, 1)}${tab === "recorrentes" ? "&aba=recorrentes" : ""}`} className={styles.monthArrow} aria-label="Próximo mês">
          ›
        </Link>
      </nav>

      <dl className={styles.summary}>
        <div className={styles.tile}>
          <dt>Recebido</dt>
          <dd className={styles.ok}>{formatCentsBRL(summary.recebidoCents)}</dd>
        </div>
        <div className={styles.tile}>
          <dt>A receber</dt>
          <dd>{formatCentsBRL(summary.pendenteCents)}</dd>
        </div>
        <div className={styles.tile}>
          <dt>Atrasado</dt>
          <dd className={summary.atrasadoCents > 0 ? styles.danger : undefined}>{formatCentsBRL(summary.atrasadoCents)}</dd>
        </div>
      </dl>
      <p className={styles.notice}>Controle manual: o FitOS não cobra seus alunos, você anota o que recebeu. A sua assinatura do FitOS fica em Assinatura.</p>

      <div className={styles.next}>
        <NextStepCard eyebrow="Próximo passo" title="Nova cobrança" description="Aluno, valor e dia. Pode repetir todo mês." onClick={() => setSheet("new")} />
      </div>

      <SegmentedTabs
        label="Financeiro"
        value={tab}
        items={[
          { key: "cobrancas", label: "Cobranças", count: charges.length, href: tabHref("cobrancas") },
          { key: "recorrentes", label: "Recorrentes", count: recurrences.length, href: tabHref("recorrentes") },
        ]}
      />

      {tab === "cobrancas" ? (
        <section aria-label="Cobranças do mês">
          {pendingRecurrences > 0 ? (
            <div className={styles.generate}>
              <span>
                {pendingRecurrences} {pendingRecurrences === 1 ? "mensalidade recorrente ainda não lançada" : "mensalidades recorrentes ainda não lançadas"} em {monthLabel.toLowerCase()}.
              </span>
              <Button type="button" disabled={busy} onClick={() => void run(async () => {
                const result = await requestJson<{ created: number }>("/api/recorrencias/gerar-mes", { method: "POST", body: JSON.stringify({ referenceMonth: monthKey }) });
                toast.show(`${result.created} ${result.created === 1 ? "cobrança gerada" : "cobranças geradas"}`);
                router.refresh();
              })}>
                Gerar todas
              </Button>
            </div>
          ) : null}
          {error && sheet === null ? <FormAlert>{error}</FormAlert> : null}
          <div className={styles.filters}>
            <ChipGroup label="Filtrar por status" variant="scroll" tone="accent" value={filter} onChange={setFilter} options={FILTERS.map((item) => ({ value: item.key, label: `${item.label} · ${counts[item.key]}` }))} />
          </div>
          {visible.length === 0 ? (
            <p className={styles.empty}>{charges.length === 0 ? "Nenhuma cobrança neste mês." : "Nenhuma cobrança com esse status."}</p>
          ) : (
            <ul className={styles.list}>
              {visible.map((charge) => {
                const tag = STATUS_TAG[charge.status];
                const open = charge.status === "PENDENTE" || charge.status === "ATRASADO";
                return (
                  <li key={charge.id}>
                    <ActionRow
                      leading={<Avatar name={charge.studentName} />}
                      title={
                        <>
                          {charge.studentName} <Tag tone={tag.tone}>{tag.label}</Tag>
                        </>
                      }
                      description={chargeMeta(charge)}
                      trailing={
                        <span className={styles.trailing}>
                          <span className={charge.status === "CANCELADO" ? `${styles.amount} ${styles.struck}` : styles.amount}>{formatCentsBRL(charge.paidCents ?? charge.amountCents)}</span>
                          {open ? (
                            <Button type="button" variant="quiet" onClick={() => openPay(charge)} aria-label={`Recebi de ${charge.studentName}`}>
                              Recebi
                            </Button>
                          ) : null}
                        </span>
                      }
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : (
        <section aria-label="Cobranças recorrentes">
          {recurrences.length === 0 ? (
            <p className={styles.empty}>Nenhuma cobrança recorrente. Use &quot;Repetir todo mês&quot; na nova cobrança.</p>
          ) : (
            <ul className={styles.list}>
              {recurrences.map((recurrence) => (
                <li key={recurrence.id}>
                  <ActionRow
                    leading={<Avatar name={recurrence.studentName} />}
                    title={recurrence.studentName}
                    description={`${recurrence.description} · ${formatCentsBRL(recurrence.amountCents)} todo dia ${recurrence.dueDay}`}
                    trailing={
                      <span className={styles.trailing}>
                        {recurrence.generatedThisMonth ? (
                          <Tag tone="ok">Lançada</Tag>
                        ) : (
                          <Button type="button" variant="quiet" disabled={busy} aria-label={`Gerar ${monthLabel.toLowerCase()} de ${recurrence.studentName}`} onClick={() => void run(async () => {
                            await requestJson(`/api/recorrencias/${recurrence.id}/gerar`, { method: "POST", body: JSON.stringify({ referenceMonth: monthKey }) });
                            toast.show(`Cobrança de ${recurrence.studentName} gerada`);
                            router.refresh();
                          })}>
                            Gerar
                          </Button>
                        )}
                        <Button type="button" variant="quiet" aria-label={`Encerrar recorrência de ${recurrence.studentName}`} onClick={() => {
                          setEnding(recurrence);
                          setError(null);
                          setSheet("end");
                        }}>
                          Encerrar
                        </Button>
                      </span>
                    }
                  />
                </li>
              ))}
            </ul>
          )}
          {error && sheet === null ? <FormAlert>{error}</FormAlert> : null}
        </section>
      )}

      {/* Recebi */}
      <Sheet
        open={sheet === "pay" && selected !== null}
        onClose={close}
        title={selected ? `Recebi de ${selected.studentName.split(/\s+/)[0]}` : "Recebi"}
        description={selected ? `${selected.description} · vence ${dayMonth.format(new Date(selected.dueDate))}` : undefined}
        footer={
          <>
            <Button type="button" block disabled={busy || !(parseReais(amount) > 0)} onClick={() => void run(async () => {
              await requestJson(`/api/cobrancas/${selected!.id}/pagamentos`, { method: "POST", body: JSON.stringify({ amountReceivedReais: parseReais(amount), paidAt: paidAtIso(), method }) });
              toast.show(`Pagamento de ${formatCentsBRL(Math.round(parseReais(amount) * 100))} registrado`);
              close();
              router.refresh();
            })}>
              Confirmar pagamento
            </Button>
            <Button type="button" variant="quiet" block onClick={openCancel}>
              Cancelar esta cobrança
            </Button>
          </>
        }
      >
        {error ? <FormAlert>{error}</FormAlert> : null}
        <div className={styles.stack}>
          <TextField label="Valor recebido (R$)" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
          <ChipGroup label="Quando" showLabel tone="accent" value={when} onChange={setWhen} options={[{ value: "hoje", label: "Hoje" }, { value: "ontem", label: "Ontem" }, { value: "outra", label: "Outra data" }]} />
          {when === "outra" ? <TextField label="Data do pagamento" type="date" value={otherDate} max={todayInput()} onChange={(event) => setOtherDate(event.target.value)} /> : null}
          <ChipGroup label="Forma de pagamento" showLabel tone="accent" value={method} onChange={setMethod} options={METHODS.map((item) => ({ value: item, label: item }))} />
        </div>
      </Sheet>

      {/* Cancelar */}
      <Sheet
        open={sheet === "cancel" && selected !== null}
        onClose={close}
        title="Cancelar cobrança?"
        description={selected ? `${selected.studentName} · ${selected.description} · ${formatCentsBRL(selected.amountCents)}. Cancelar não é o mesmo que receber.` : undefined}
        footer={
          <>
            <Button type="button" block variant="danger" disabled={busy || !reason || (reason === "Outro" && otherReason.trim().length === 0)} onClick={() => void run(async () => {
              await requestJson(`/api/cobrancas/${selected!.id}/cancelar`, { method: "POST", body: JSON.stringify({ reason: reason === "Outro" ? otherReason.trim() : reason }) });
              toast.show("Cobrança cancelada");
              close();
              router.refresh();
            })}>
              Cancelar cobrança
            </Button>
            <Button type="button" variant="quiet" block onClick={close}>
              Voltar
            </Button>
          </>
        }
      >
        {error ? <FormAlert>{error}</FormAlert> : null}
        <div className={styles.stack}>
          <ChipGroup label="Motivo" showLabel tone="accent" value={reason} onChange={setReason} options={CANCEL_REASONS.map((item) => ({ value: item, label: item }))} />
          {reason === "Outro" ? <TextField label="Qual o motivo?" value={otherReason} maxLength={300} onChange={(event) => setOtherReason(event.target.value)} /> : null}
        </div>
      </Sheet>

      {/* Encerrar recorrência */}
      <Sheet
        open={sheet === "end" && ending !== null}
        onClose={close}
        title="Encerrar recorrência?"
        description={ending ? `${ending.studentName} deixa de ter ${ending.description.toLowerCase()} lançada todo mês. As cobranças já lançadas continuam.` : undefined}
        footer={
          <>
            <Button type="button" block variant="danger" disabled={busy} onClick={() => void run(async () => {
              await requestJson(`/api/recorrencias/${ending!.id}/encerrar`, { method: "POST" });
              toast.show("Recorrência encerrada");
              close();
              router.refresh();
            })}>
              Encerrar
            </Button>
            <Button type="button" variant="quiet" block onClick={close}>
              Voltar
            </Button>
          </>
        }
      >
        {error ? <FormAlert>{error}</FormAlert> : null}
      </Sheet>

      {/* Nova cobrança */}
      <Sheet
        open={sheet === "new"}
        onClose={close}
        title="Nova cobrança"
        description={`Competência: ${monthLabel.toLowerCase()}.`}
        footer={
          <>
            <Button type="button" block disabled={busy || !studentId || !(parseReais(newAmount) > 0) || description.trim().length === 0} onClick={() => void run(async () => {
              await requestJson("/api/cobrancas", {
                method: "POST",
                body: JSON.stringify({ studentId, amountReais: parseReais(newAmount), dueDayOfMonth: dueDay, description: description.trim(), referenceMonth: monthKey, repeatMonthly: repeat }),
              });
              toast.show(repeat ? "Cobrança criada e repetida todo mês" : "Cobrança criada");
              close();
              setStudentId(null);
              setNewAmount("");
              router.refresh();
            })}>
              Criar cobrança
            </Button>
            <Button type="button" variant="quiet" block onClick={close}>
              Agora não
            </Button>
          </>
        }
      >
        {error ? <FormAlert>{error}</FormAlert> : null}
        {students.length === 0 ? (
          <p className={styles.empty}>
            Nenhum aluno ativo. <Link href="/painel/alunos?novo=1">Convidar aluno</Link>
          </p>
        ) : (
          <div className={styles.stack}>
            <ChipGroup label="Aluno" showLabel tone="accent" value={studentId} onChange={setStudentId} options={students.map((student) => ({ value: student.id, label: student.displayName }))} />
            <TextField label="Valor (R$)" inputMode="decimal" placeholder="180,00" value={newAmount} onChange={(event) => setNewAmount(event.target.value)} />
            <Stepper label="Vence todo dia" value={dueDay} min={1} max={28} onChange={setDueDay} />
            <ChipGroup label="Descrição" showLabel tone="accent" value={DESCRIPTIONS.includes(description) ? description : null} onChange={setDescription} options={DESCRIPTIONS.map((item) => ({ value: item, label: item }))} />
            <TextField label="Ou escreva" value={description} maxLength={200} onChange={(event) => setDescription(event.target.value)} />
            <Switch label="Repetir todo mês" description="Fica em Recorrentes e é lançada com &quot;Gerar todas&quot;." checked={repeat} onChange={setRepeat} />
          </div>
        )}
      </Sheet>
    </div>
  );
}

function shift(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split("-").map(Number) as [number, number];
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
