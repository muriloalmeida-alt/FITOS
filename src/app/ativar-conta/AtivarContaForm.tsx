"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, FormAlert, TextField } from "@/shared/ui";
import { PasswordField } from "../_entrada/PasswordField";
import styles from "../_entrada/Entrada.module.css";

/// Ativar convite (FIT-165): e-mail fixo (o que o personal cadastrou) e só
/// a senha, com "Mostrar". Leva direto ao Início do Aluno.
export function AtivarContaForm({ token, email }: { token: string; email: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    if (password.length < 8) {
      setError("Use pelo menos 8 caracteres.");
      return;
    }
    setError(undefined);
    setFormError(null);
    setIsSubmitting(true);
    const response = await fetch("/api/ativar-conta", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setFormError(body?.message ?? "Não foi possível ativar a conta. Tente novamente.");
      setIsSubmitting(false);
      return;
    }
    router.push("/painel");
    router.refresh();
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {formError ? <FormAlert variant="error">{formError}</FormAlert> : null}
      <TextField label="E-mail" name="email" type="email" value={email} readOnly aria-readonly="true" />
      <PasswordField label="Crie sua senha" value={password} onChange={setPassword} error={error} autoComplete="new-password" disabled={isSubmitting} />
      <Button type="submit" size="lg" block disabled={isSubmitting}>
        {isSubmitting ? "Ativando…" : "Entrar no FitOS"}
      </Button>
    </form>
  );
}
