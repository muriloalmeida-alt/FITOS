"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, FormAlert, TextField } from "@/shared/ui";
import { signIn } from "@/modules/identity/auth-client";
import styles from "./page.module.css";

interface FieldErrors {
  email?: string;
  password?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EntrarForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const errors: FieldErrors = {};
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      errors.email = "Informe um e-mail válido.";
    }
    if (password.length === 0) {
      errors.password = "Informe sua senha.";
    }
    setFieldErrors(errors);
    setFormError(null);

    if (Object.keys(errors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    const { error } = await signIn.email({ email: normalizedEmail, password });
    setIsSubmitting(false);

    if (error) {
      // Mensagem deliberadamente genérica: não revela se o e-mail existe,
      // apenas que a combinação e-mail/senha não permite acesso.
      setFormError("E-mail ou senha inválidos.");
      return;
    }

    const redirecionar = searchParams.get("redirecionar");
    router.push(redirecionar && redirecionar.startsWith("/") ? redirecionar : "/painel");
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {formError ? <FormAlert variant="error">{formError}</FormAlert> : null}

      <TextField
        label="E-mail"
        name="email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={fieldErrors.email}
        disabled={isSubmitting}
        required
      />
      <TextField
        label="Senha"
        name="password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={fieldErrors.password}
        disabled={isSubmitting}
        required
      />

      <Button type="submit" variant="filled" disabled={isSubmitting}>
        {isSubmitting ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
