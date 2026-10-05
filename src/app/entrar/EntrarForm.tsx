"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, TextField } from "@/shared/ui";
import { signIn } from "@/modules/identity/auth-client";
import styles from "../_entrada/Entrada.module.css";
import { PasswordField } from "../_entrada/PasswordField";

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

    if (error?.status === 429) {
      // Limite de tentativas do Better Auth: não é senha errada.
      setFormError("Muitas tentativas seguidas. Aguarde alguns segundos e tente de novo.");
      return;
    }

    if (error) {
      // Mensagem deliberadamente genérica: não revela se o e-mail existe.
      // Fica junto do campo de senha (FIT-163).
      setFieldErrors({ password: "E-mail ou senha inválidos. Confira e tente de novo." });
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
        inputMode="email"
        autoComplete="username"
        placeholder="seu@email.com"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={fieldErrors.email}
        disabled={isSubmitting}
        required
      />
      <PasswordField value={password} onChange={setPassword} error={fieldErrors.password ?? formError ?? undefined} autoComplete="current-password" disabled={isSubmitting} />
      <Button type="submit" variant="filled" size="lg" block disabled={isSubmitting}>
        {isSubmitting ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
