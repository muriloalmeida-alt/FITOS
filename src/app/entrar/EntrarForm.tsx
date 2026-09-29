"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, TextField } from "@/shared/ui";
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
    <form className={styles.form} onSubmit={handleSubmit} aria-busy={isSubmitting} noValidate>
      <TextField
        label="E-mail"
        name="email"
        type="email"
        autoComplete="username"
        placeholder="seu@email.com"
        className={styles.field}
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
        className={styles.field}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={fieldErrors.password}
        disabled={isSubmitting}
        required
      />

      {/* Espaço reservado junto aos campos: o aviso de credenciais aparece
          aqui sem encobrir campos/botão e sem salto grande de layout
          (AjustesLogin). Texto claro + indicador "!" além da cor. */}
      <div className={styles.feedback}>
        {formError ? (
          <div className={styles.formError} role="alert">
            <span className={styles.formErrorIcon} aria-hidden>
              !
            </span>
            <p className={styles.formErrorText}>
              <strong>{formError}</strong>
              <span className={styles.formErrorHelp}>Confira os dados e tente novamente.</span>
            </p>
          </div>
        ) : null}
      </div>

      <Button type="submit" className={styles.submit} variant="filled" disabled={isSubmitting}>
        {isSubmitting ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
