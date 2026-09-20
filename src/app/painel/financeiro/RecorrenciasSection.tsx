"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, FormAlert, TextField } from "@/shared/ui";
import { formatCentsBRL } from "@/shared/lib/money";
import styles from "./FinanceiroSection.module.css";
import type { StudentOption } from "./FinanceiroSection";

export interface ChargeRecurrenceProp {
  id: string;
  description: string;
  amountCents: number;
  dueDayOfMonth: number;
  student: { id: string; displayName: string };
}

interface RecorrenciasSectionProps {
  students: StudentOption[];
  recurrences: ChargeRecurrenceProp[];
}

/// Cobrança recorrente (FIT-052): cada geração cria um lançamento
/// independente — nunca uma referência viva à recorrência. Sem
/// infraestrutura de agendamento nesta MVP: "Gerar cobrança do mês" é
/// sempre uma ação explícita do personal.
export function RecorrenciasSection({ students, recurrences }: RecorrenciasSectionProps) {
  const router = useRouter();
  const [studentId, setStudentId] = useState("");
  const [description, setDescription] = useState("");
  const [amountReais, setAmountReais] = useState("");
  const [dueDayOfMonth, setDueDayOfMonth] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

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
      const response = await fetch(`/api/students/${studentId}/recorrencias`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, amountReais: Number(amountReais), dueDayOfMonth: Number(dueDayOfMonth) }),
      });
      setIsSubmitting(false);
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setFormError(body?.message ?? "Não foi possível cadastrar a recorrência. Tente novamente.");
        return;
      }
      setStudentId("");
      setDescription("");
      setAmountReais("");
      setDueDayOfMonth("");
      router.refresh();
    } catch {
      setIsSubmitting(false);
      setFormError("Falha de conexão. Verifique sua internet e tente novamente.");
    }
  }

  async function handleGenerate(recurrenceId: string) {
    if (pendingActionId) {
      return;
    }
    setRowError(null);
    setPendingActionId(recurrenceId);
    try {
      const response = await fetch(`/api/recorrencias/${recurrenceId}/gerar`, { method: "POST" });
      setPendingActionId(null);
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setRowError(body?.message ?? "Não foi possível gerar a cobrança deste mês. Tente novamente.");
        return;
      }
      router.refresh();
    } catch {
      setPendingActionId(null);
      setRowError("Falha de conexão. Verifique sua internet e tente novamente.");
    }
  }

  async function handleEnd(recurrenceId: string) {
    if (pendingActionId) {
      return;
    }
    setRowError(null);
    setPendingActionId(recurrenceId);
    try {
      const response = await fetch(`/api/recorrencias/${recurrenceId}/encerrar`, { method: "POST" });
      setPendingActionId(null);
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setRowError(body?.message ?? "Não foi possível encerrar a recorrência. Tente novamente.");
        return;
      }
      router.refresh();
    } catch {
      setPendingActionId(null);
      setRowError("Falha de conexão. Verifique sua internet e tente novamente.");
    }
  }

  return (
    <div className={styles.container}>
      {recurrences.length === 0 ? (
        <p className={styles.empty}>Nenhuma cobrança recorrente ativa ainda.</p>
      ) : (
        <ul className={styles.list} aria-label="Cobranças recorrentes ativas">
          {recurrences.map((recurrence) => (
            <li key={recurrence.id} className={styles.row}>
              <span className={styles.rowStudent}>{recurrence.student.displayName}</span>
              <span className={styles.rowDetails}>
                {recurrence.description} · {formatCentsBRL(recurrence.amountCents)} · vence todo dia {recurrence.dueDayOfMonth}
              </span>
              <div className={styles.rowActions}>
                <Button type="button" variant="filled" onClick={() => handleGenerate(recurrence.id)} disabled={pendingActionId !== null}>
                  {pendingActionId === recurrence.id ? "Gerando…" : "Gerar cobrança do mês"}
                </Button>
                <Button type="button" variant="outlined" onClick={() => handleEnd(recurrence.id)} disabled={pendingActionId !== null}>
                  Encerrar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {rowError ? <FormAlert variant="error">{rowError}</FormAlert> : null}

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <h3 className={styles.formTitle}>Nova cobrança recorrente</h3>
        {formError ? <FormAlert variant="error">{formError}</FormAlert> : null}

        {students.length === 0 ? (
          <p className={styles.empty}>Nenhum aluno ativo para cobrar ainda.</p>
        ) : (
          <>
            <div className={styles.selectField}>
              <label className={styles.selectLabel} htmlFor="recurrenceStudentId">
                Aluno
              </label>
              <select
                id="recurrenceStudentId"
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
              name="recurrenceDescription"
              type="text"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={isSubmitting}
            />

            <div className={styles.fieldsGrid}>
              <TextField
                label="Valor (R$)"
                name="recurrenceAmountReais"
                type="number"
                min={0.01}
                step={0.01}
                value={amountReais}
                onChange={(event) => setAmountReais(event.target.value)}
                disabled={isSubmitting}
              />
              <TextField
                label="Dia de vencimento (1-28)"
                name="dueDayOfMonth"
                type="number"
                min={1}
                max={28}
                step={1}
                value={dueDayOfMonth}
                onChange={(event) => setDueDayOfMonth(event.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <Button type="submit" variant="filled" disabled={isSubmitting}>
              {isSubmitting ? "Cadastrando…" : "Cadastrar recorrência"}
            </Button>
          </>
        )}
      </form>
    </div>
  );
}
