"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, FormAlert, TextField } from "@/shared/ui";
import { formatCentsBRL } from "@/shared/lib/money";
import styles from "./FinanceiroSection.module.css";

export interface StudentOption {
  id: string;
  displayName: string;
}

export interface ChargeProp {
  id: string;
  description: string;
  amountCents: number;
  referenceMonth: string;
  dueDate: string;
  status: "PENDENTE" | "PAGO" | "ATRASADO" | "CANCELADO";
  cancelReason: string | null;
  student: { id: string; displayName: string };
  payment: { amountCentsPaid: number; paidAt: string; method: string } | null;
}

interface FinanceiroSectionProps {
  students: StudentOption[];
  charges: ChargeProp[];
}

const STATUS_LABEL: Record<ChargeProp["status"], string> = {
  PENDENTE: "Pendente",
  PAGO: "Pago",
  ATRASADO: "Atrasado",
  CANCELADO: "Cancelado",
};

/// "A vencer" é só apresentação calculada sobre `PENDENTE` com vencimento
/// futuro — nunca um estado armazenado (regra registrada desde a FIT-007
/// no README de `src/modules/student-finance/`).
function displayStatusLabel(charge: ChargeProp): string {
  if (charge.status === "PENDENTE" && new Date(charge.dueDate) >= new Date(new Date().toDateString())) {
    return "A vencer";
  }
  return STATUS_LABEL[charge.status];
}

function formatMonth(referenceMonth: string): string {
  return new Date(referenceMonth).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

/// Cadastro de cobrança (FIT-050) e lista de recebimentos do tenant —
/// cancelamento exige motivo e nunca equivale a pagamento
/// (`REGRAS-DE-NEGOCIO.md` seção 8).
export function FinanceiroSection({ students, charges }: FinanceiroSectionProps) {
  const router = useRouter();
  const [studentId, setStudentId] = useState("");
  const [description, setDescription] = useState("");
  const [amountReais, setAmountReais] = useState("");
  const [referenceMonth, setReferenceMonth] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [rowError, setRowError] = useState<string | null>(null);
  const [isCanceling, setIsCanceling] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }
    setFormError(null);
    if (!studentId) {
      setFormError("Selecione um aluno.");
      return;
    }
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/students/${studentId}/cobrancas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          amountReais: Number(amountReais),
          referenceMonth: `${referenceMonth}-01`,
          dueDate,
        }),
      });
      setIsSubmitting(false);
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setFormError(body?.message ?? "Não foi possível cadastrar a cobrança. Tente novamente.");
        return;
      }
      setStudentId("");
      setDescription("");
      setAmountReais("");
      setReferenceMonth("");
      setDueDate("");
      router.refresh();
    } catch {
      setIsSubmitting(false);
      setFormError("Falha de conexão. Verifique sua internet e tente novamente.");
    }
  }

  async function handleConfirmCancel(chargeId: string) {
    if (isCanceling) {
      return;
    }
    setRowError(null);
    if (cancelReason.trim() === "") {
      setRowError("Informe o motivo do cancelamento.");
      return;
    }
    setIsCanceling(true);
    try {
      const response = await fetch(`/api/cobrancas/${chargeId}/cancelar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason }),
      });
      setIsCanceling(false);
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setRowError(body?.message ?? "Não foi possível cancelar a cobrança. Tente novamente.");
        return;
      }
      setCancelingId(null);
      setCancelReason("");
      router.refresh();
    } catch {
      setIsCanceling(false);
      setRowError("Falha de conexão. Verifique sua internet e tente novamente.");
    }
  }

  return (
    <div className={styles.container}>
      {charges.length === 0 ? (
        <p className={styles.empty}>Nenhuma cobrança cadastrada ainda.</p>
      ) : (
        <ul className={styles.list} aria-label="Lista de recebimentos, competência mais recente primeiro">
          {charges.map((charge) => (
            <li key={charge.id} className={styles.row}>
              <span className={styles.rowStudent}>{charge.student.displayName}</span>
              <span className={styles.rowDetails}>
                {charge.description} · Competência: {formatMonth(charge.referenceMonth)} · Vencimento: {formatDate(charge.dueDate)}
              </span>
              <span className={styles.rowAmount}>{formatCentsBRL(charge.amountCents)}</span>
              <span className={styles.rowStatus} data-status={charge.status}>
                {displayStatusLabel(charge)}
              </span>
              {charge.status === "CANCELADO" && charge.cancelReason ? (
                <span className={styles.rowNotes}>Motivo: {charge.cancelReason}</span>
              ) : null}

              {charge.status === "PENDENTE" || charge.status === "ATRASADO" ? (
                cancelingId === charge.id ? (
                  <div className={styles.cancelForm}>
                    <TextField
                      label="Motivo do cancelamento"
                      name="cancelReason"
                      type="text"
                      value={cancelReason}
                      onChange={(event) => setCancelReason(event.target.value)}
                      disabled={isCanceling}
                    />
                    <div className={styles.rowActions}>
                      <Button type="button" variant="filled" onClick={() => handleConfirmCancel(charge.id)} disabled={isCanceling}>
                        {isCanceling ? "Cancelando…" : "Confirmar cancelamento"}
                      </Button>
                      <Button
                        type="button"
                        variant="outlined"
                        onClick={() => {
                          setCancelingId(null);
                          setCancelReason("");
                          setRowError(null);
                        }}
                        disabled={isCanceling}
                      >
                        Voltar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className={styles.rowActions}>
                    <Button type="button" variant="outlined" onClick={() => setCancelingId(charge.id)}>
                      Cancelar
                    </Button>
                  </div>
                )
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {rowError ? <FormAlert variant="error">{rowError}</FormAlert> : null}

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <h3 className={styles.formTitle}>Cadastrar cobrança</h3>
        {formError ? <FormAlert variant="error">{formError}</FormAlert> : null}

        {students.length === 0 ? (
          <p className={styles.empty}>Nenhum aluno ativo para cobrar ainda.</p>
        ) : (
          <>
            <div className={styles.selectField}>
              <label className={styles.selectLabel} htmlFor="studentId">
                Aluno
              </label>
              <select
                id="studentId"
                className={styles.select}
                value={studentId}
                onChange={(event) => setStudentId(event.target.value)}
                disabled={isSubmitting}
              >
                <option value="">Selecione um aluno</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.displayName}
                  </option>
                ))}
              </select>
            </div>

            <TextField
              label="Descrição"
              name="description"
              type="text"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={isSubmitting}
            />

            <div className={styles.fieldsGrid}>
              <TextField
                label="Valor (R$)"
                name="amountReais"
                type="number"
                min={0.01}
                step={0.01}
                value={amountReais}
                onChange={(event) => setAmountReais(event.target.value)}
                disabled={isSubmitting}
              />
              <TextField
                label="Competência"
                name="referenceMonth"
                type="month"
                value={referenceMonth}
                onChange={(event) => setReferenceMonth(event.target.value)}
                disabled={isSubmitting}
              />
              <TextField
                label="Vencimento"
                name="dueDate"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <Button type="submit" variant="filled" disabled={isSubmitting}>
              {isSubmitting ? "Cadastrando…" : "Cadastrar cobrança"}
            </Button>
          </>
        )}
      </form>
    </div>
  );
}
