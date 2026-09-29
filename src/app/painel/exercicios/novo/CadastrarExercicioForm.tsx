"use client";

import { useId, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, FormAlert, TextField } from "@/shared/ui";
import styles from "./page.module.css";

const DEFAULT_REDIRECT = "/painel/exercicios";

interface FieldErrors {
  name?: string;
}

/// Alvo do redirecionamento pós-cadastro (FIT-142): por padrão volta ao
/// catálogo (`/painel/exercicios`, fluxo original do personal desde a
/// FIT-022); quando chega aqui a partir do builder de treino do Livre
/// (`ItensDoMeuTreino`), `?returnTo=` leva de volta ao treino em edição.
/// Só aceita um caminho interno começando com uma única barra — nunca uma
/// URL absoluta nem `//`, que navegaria para fora do app.
function safeReturnTo(value: string | null): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }
  return DEFAULT_REDIRECT;
}

export function CadastrarExercicioForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = safeReturnTo(searchParams.get("returnTo"));
  const instructionsId = useId();
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [muscle, setMuscle] = useState("");
  const [equipments, setEquipments] = useState("");
  const [instructions, setInstructions] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    if (name.trim().length === 0) {
      setFieldErrors({ name: "Informe o nome do exercício." });
      return;
    }
    setFieldErrors({});
    setFormError(null);

    setIsSubmitting(true);
    const response = await fetch("/api/exercises", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        type: type.trim() || undefined,
        muscle: muscle.trim() || undefined,
        equipments: equipments.trim() || undefined,
        instructions: instructions.trim() || undefined,
      }),
    });
    setIsSubmitting(false);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setFormError(body?.message ?? "Não foi possível cadastrar o exercício. Tente novamente.");
      return;
    }

    router.push(returnTo);
    router.refresh();
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {formError ? <FormAlert variant="error">{formError}</FormAlert> : null}

      <TextField
        label="Nome"
        name="name"
        type="text"
        value={name}
        onChange={(event) => setName(event.target.value)}
        error={fieldErrors.name}
        disabled={isSubmitting}
        required
      />
      <TextField
        label="Tipo/categoria"
        name="type"
        type="text"
        value={type}
        onChange={(event) => setType(event.target.value)}
        disabled={isSubmitting}
      />
      <TextField
        label="Músculo principal"
        name="muscle"
        type="text"
        value={muscle}
        onChange={(event) => setMuscle(event.target.value)}
        disabled={isSubmitting}
      />
      <TextField
        label="Equipamento"
        name="equipments"
        type="text"
        value={equipments}
        onChange={(event) => setEquipments(event.target.value)}
        disabled={isSubmitting}
      />
      <div className={styles.textareaField}>
        <label className={styles.textareaLabel} htmlFor={instructionsId}>
          Instruções
        </label>
        <textarea
          id={instructionsId}
          className={styles.textarea}
          value={instructions}
          onChange={(event) => setInstructions(event.target.value)}
          disabled={isSubmitting}
        />
      </div>

      <Button type="submit" variant="filled" disabled={isSubmitting}>
        {isSubmitting ? "Cadastrando…" : "Cadastrar exercício"}
      </Button>
    </form>
  );
}
