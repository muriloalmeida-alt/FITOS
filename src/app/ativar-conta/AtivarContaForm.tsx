"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, FormAlert, TextField } from "@/shared/ui";
import styles from "./page.module.css";

interface FieldErrors {
  password?: string;
  confirmPassword?: string;
}

/// Define a senha e ativa a conta (FIT-015). Não pede e-mail — o e-mail já
/// é conhecido (o que o personal cadastrou), evitando que o aluno digite um
/// e-mail diferente do que o convite foi endereçado a.
export function AtivarContaForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    const errors: FieldErrors = {};
    if (password.length < 8) {
      errors.password = "A senha deve ter pelo menos 8 caracteres.";
    }
    if (confirmPassword !== password) {
      errors.confirmPassword = "As senhas não coincidem.";
    }
    setFieldErrors(errors);
    setFormError(null);

    if (Object.keys(errors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    const response = await fetch("/api/ativar-conta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    setIsSubmitting(false);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setFormError(body?.message ?? "Não foi possível ativar a conta. Tente novamente.");
      return;
    }

    router.push("/painel");
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {formError ? <FormAlert variant="error">{formError}</FormAlert> : null}

      <TextField
        label="Senha"
        name="password"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={fieldErrors.password}
        disabled={isSubmitting}
        required
      />
      <TextField
        label="Confirmar senha"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
        error={fieldErrors.confirmPassword}
        disabled={isSubmitting}
        required
      />

      <Button type="submit" variant="filled" disabled={isSubmitting}>
        {isSubmitting ? "Ativando…" : "Ativar conta"}
      </Button>
    </form>
  );
}
