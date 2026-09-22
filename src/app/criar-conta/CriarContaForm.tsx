"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, FormAlert, TextField } from "@/shared/ui";
import { signUp } from "@/modules/identity/auth-client";
import styles from "./page.module.css";

interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(values: { name: string; email: string; password: string; confirmPassword: string }): FieldErrors {
  const errors: FieldErrors = {};

  if (values.name.trim().length < 2) {
    errors.name = "Informe seu nome completo.";
  }
  if (!EMAIL_PATTERN.test(values.email.trim())) {
    errors.email = "Informe um e-mail válido.";
  }
  if (values.password.length < 8) {
    errors.password = "A senha deve ter pelo menos 8 caracteres.";
  }
  if (values.confirmPassword !== values.password) {
    errors.confirmPassword = "As senhas não coincidem.";
  }

  return errors;
}

interface CriarContaFormProps {
  /// "individual" é a escolha explícita do onboarding "Treino sozinho"
  /// (FIT-101, `/criar-conta?modo=individual`) — qualquer outro valor
  /// (incluindo ausente) permanece o cadastro de personal de sempre.
  /// Nunca lido de um campo de formulário: o literal já vem fixado pela
  /// própria página server-side a partir da query string (ver ADR-007).
  mode?: "personal" | "individual";
}

export function CriarContaForm({ mode = "personal" }: CriarContaFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
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

    const normalizedEmail = email.trim().toLowerCase();
    const errors = validate({ name, email: normalizedEmail, password, confirmPassword });
    setFieldErrors(errors);
    setFormError(null);

    if (Object.keys(errors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    const { error } = await signUp.email({
      name: name.trim(),
      email: normalizedEmail,
      password,
      role: mode === "individual" ? "INDIVIDUAL" : "PERSONAL",
    });
    setIsSubmitting(false);

    if (error) {
      setFormError("Não foi possível criar sua conta com os dados informados. Verifique e tente novamente.");
      return;
    }

    router.push(mode === "individual" ? "/onboarding" : "/painel");
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {formError ? <FormAlert variant="error">{formError}</FormAlert> : null}

      <TextField
        label="Nome completo"
        name="name"
        type="text"
        autoComplete="name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        error={fieldErrors.name}
        disabled={isSubmitting}
        required
      />
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
        {isSubmitting ? "Criando conta…" : "Criar conta"}
      </Button>
    </form>
  );
}
