"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, FormAlert, TextField } from "@/shared/ui";
import styles from "./AvaliacoesSection.module.css";

const MEASUREMENT_TYPES = ["CINTURA", "QUADRIL", "PEITO", "BRACO", "COXA", "PANTURRILHA"] as const;
type MeasurementType = (typeof MEASUREMENT_TYPES)[number];

const MEASUREMENT_LABEL: Record<MeasurementType, string> = {
  CINTURA: "Cintura",
  QUADRIL: "Quadril",
  PEITO: "Peito",
  BRACO: "Braço",
  COXA: "Coxa",
  PANTURRILHA: "Panturrilha",
};

export interface AssessmentMeasurementProp {
  type: MeasurementType;
  valueCm: number;
}

export interface AssessmentProp {
  id: string;
  recordedAt: string;
  weightKg: number | null;
  bodyFatPercent: number | null;
  notes: string | null;
  measurements: AssessmentMeasurementProp[];
}

interface AvaliacoesSectionProps {
  studentId: string;
  assessments: AssessmentProp[];
}

function formatMeasurements(measurements: AssessmentMeasurementProp[]): string {
  return measurements.map((m) => `${MEASUREMENT_LABEL[m.type]}: ${m.valueCm}cm`).join(" · ");
}

/// Registro e histórico de avaliações do aluno (FIT-042). Uma avaliação,
/// uma vez criada, nunca é editada — só excluída logicamente (exclusão
/// física nunca acontece por esta via).
export function AvaliacoesSection({ studentId, assessments }: AvaliacoesSectionProps) {
  const router = useRouter();
  const [weightKg, setWeightKg] = useState("");
  const [bodyFatPercent, setBodyFatPercent] = useState("");
  const [notes, setNotes] = useState("");
  const [measurementValues, setMeasurementValues] = useState<Record<MeasurementType, string>>({
    CINTURA: "",
    QUADRIL: "",
    PEITO: "",
    BRACO: "",
    COXA: "",
    PANTURRILHA: "",
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }
    setFormError(null);
    setIsSubmitting(true);

    const measurements = MEASUREMENT_TYPES.filter((type) => measurementValues[type].trim() !== "").map((type) => ({
      type,
      valueCm: Number(measurementValues[type]),
    }));

    try {
      const response = await fetch(`/api/students/${studentId}/avaliacoes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weightKg: weightKg.trim() === "" ? null : Number(weightKg),
          bodyFatPercent: bodyFatPercent.trim() === "" ? null : Number(bodyFatPercent),
          notes: notes.trim() === "" ? null : notes.trim(),
          measurements,
        }),
      });
      setIsSubmitting(false);
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setFormError(body?.message ?? "Não foi possível registrar a avaliação. Tente novamente.");
        return;
      }
      setWeightKg("");
      setBodyFatPercent("");
      setNotes("");
      setMeasurementValues({ CINTURA: "", QUADRIL: "", PEITO: "", BRACO: "", COXA: "", PANTURRILHA: "" });
      router.refresh();
    } catch {
      setIsSubmitting(false);
      setFormError("Falha de conexão. Verifique sua internet e tente novamente.");
    }
  }

  async function handleDelete(assessmentId: string) {
    if (pendingDeleteId) {
      return;
    }
    setRowError(null);
    setPendingDeleteId(assessmentId);
    try {
      const response = await fetch(`/api/students/${studentId}/avaliacoes/${assessmentId}`, { method: "DELETE" });
      setPendingDeleteId(null);
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setRowError(body?.message ?? "Não foi possível excluir a avaliação. Tente novamente.");
        return;
      }
      router.refresh();
    } catch {
      setPendingDeleteId(null);
      setRowError("Falha de conexão. Verifique sua internet e tente novamente.");
    }
  }

  return (
    <div className={styles.container}>
      {assessments.length === 0 ? (
        <p className={styles.empty}>Nenhuma avaliação registrada ainda.</p>
      ) : (
        <ul className={styles.list} aria-label="Histórico de avaliações, mais recente primeiro">
          {assessments.map((assessment) => (
            <li key={assessment.id} className={styles.row}>
              <span className={styles.rowDate}>{new Date(assessment.recordedAt).toLocaleDateString("pt-BR")}</span>
              <span className={styles.rowDetails}>
                {[
                  assessment.weightKg !== null ? `${assessment.weightKg}kg` : null,
                  assessment.bodyFatPercent !== null ? `${assessment.bodyFatPercent}% de gordura` : null,
                  formatMeasurements(assessment.measurements) || null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Sem parâmetros numéricos"}
              </span>
              {assessment.notes ? <span className={styles.rowNotes}>{assessment.notes}</span> : null}
              <div className={styles.rowActions}>
                <Button type="button" variant="outlined" onClick={() => handleDelete(assessment.id)} disabled={pendingDeleteId !== null}>
                  {pendingDeleteId === assessment.id ? "Excluindo…" : "Excluir"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {rowError ? <FormAlert variant="error">{rowError}</FormAlert> : null}

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <h3 className={styles.formTitle}>Registrar avaliação</h3>
        {formError ? <FormAlert variant="error">{formError}</FormAlert> : null}

        <div className={styles.fieldsGrid}>
          <TextField
            label="Peso (kg)"
            name="weightKg"
            type="number"
            min={0.1}
            step={0.1}
            value={weightKg}
            onChange={(event) => setWeightKg(event.target.value)}
            disabled={isSubmitting}
          />
          <TextField
            label="Gordura (%)"
            name="bodyFatPercent"
            type="number"
            min={0.1}
            step={0.1}
            value={bodyFatPercent}
            onChange={(event) => setBodyFatPercent(event.target.value)}
            disabled={isSubmitting}
          />
        </div>

        <p className={styles.measurementsLegend}>Medidas (cm)</p>
        <div className={styles.fieldsGrid}>
          {MEASUREMENT_TYPES.map((type) => (
            <TextField
              key={type}
              label={MEASUREMENT_LABEL[type]}
              name={`measurement-${type}`}
              type="number"
              min={0.1}
              step={0.1}
              value={measurementValues[type]}
              onChange={(event) => setMeasurementValues((current) => ({ ...current, [type]: event.target.value }))}
              disabled={isSubmitting}
            />
          ))}
        </div>

        <TextField
          label="Observação"
          name="notes"
          type="text"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          disabled={isSubmitting}
        />

        <Button type="submit" variant="filled" disabled={isSubmitting}>
          {isSubmitting ? "Registrando…" : "Registrar avaliação"}
        </Button>
      </form>
    </div>
  );
}
