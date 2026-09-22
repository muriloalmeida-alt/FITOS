"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { BodyMeasurementType } from "@prisma/client";
import { Button, FormAlert, TextField } from "@/shared/ui";
import styles from "./RegistrarAvaliacaoForm.module.css";

const MEASUREMENT_FIELDS: { type: BodyMeasurementType; label: string }[] = [
  { type: "CINTURA", label: "Cintura (cm)" },
  { type: "QUADRIL", label: "Quadril (cm)" },
  { type: "PEITO", label: "Peito (cm)" },
  { type: "BRACO", label: "Braço (cm)" },
  { type: "COXA", label: "Coxa (cm)" },
  { type: "PANTURRILHA", label: "Panturrilha (cm)" },
];

function parseOptionalNumber(value: string): number | null {
  if (value.trim().length === 0) {
    return null;
  }
  const parsed = Number.parseFloat(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

export function RegistrarAvaliacaoForm() {
  const router = useRouter();
  const [weightKg, setWeightKg] = useState("");
  const [bodyFatPercent, setBodyFatPercent] = useState("");
  const [notes, setNotes] = useState("");
  const [measurements, setMeasurements] = useState<Record<BodyMeasurementType, string>>({
    CINTURA: "",
    QUADRIL: "",
    PEITO: "",
    BRACO: "",
    COXA: "",
    PANTURRILHA: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    setError(null);

    const measurementsCm = MEASUREMENT_FIELDS.map(({ type }) => ({ type, valueCm: parseOptionalNumber(measurements[type]) })).filter(
      (m): m is { type: BodyMeasurementType; valueCm: number } => m.valueCm !== null
    );

    const response = await fetch("/api/minhas-avaliacoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        weightKg: parseOptionalNumber(weightKg),
        bodyFatPercent: parseOptionalNumber(bodyFatPercent),
        notes: notes.trim().length > 0 ? notes : null,
        measurementsCm,
      }),
    });
    setIsSubmitting(false);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.message ?? "Não foi possível salvar a avaliação. Tente novamente.");
      return;
    }

    setWeightKg("");
    setBodyFatPercent("");
    setNotes("");
    setMeasurements({ CINTURA: "", QUADRIL: "", PEITO: "", BRACO: "", COXA: "", PANTURRILHA: "" });
    router.refresh();
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {error ? <FormAlert variant="error">{error}</FormAlert> : null}
      <div className={styles.grid}>
        <TextField
          label="Peso (kg)"
          name="weightKg"
          inputMode="decimal"
          value={weightKg}
          onChange={(event) => setWeightKg(event.target.value)}
          disabled={isSubmitting}
        />
        <TextField
          label="% de gordura"
          name="bodyFatPercent"
          inputMode="decimal"
          value={bodyFatPercent}
          onChange={(event) => setBodyFatPercent(event.target.value)}
          disabled={isSubmitting}
        />
      </div>
      <div className={styles.grid}>
        {MEASUREMENT_FIELDS.map(({ type, label }) => (
          <TextField
            key={type}
            label={label}
            name={`measurement-${type}`}
            inputMode="decimal"
            value={measurements[type]}
            onChange={(event) => setMeasurements((current) => ({ ...current, [type]: event.target.value }))}
            disabled={isSubmitting}
          />
        ))}
      </div>
      <TextField
        label="Observação (opcional)"
        name="notes"
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        disabled={isSubmitting}
      />
      <Button type="submit" variant="filled" disabled={isSubmitting}>
        {isSubmitting ? "Salvando…" : "Registrar avaliação"}
      </Button>
    </form>
  );
}
