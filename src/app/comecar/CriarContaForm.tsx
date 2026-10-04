"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, FormAlert, TextField } from "@/shared/ui";
import { signUp } from "@/modules/identity/auth-client";
import { PasswordField } from "../_entrada/PasswordField";
import styles from "../_entrada/Entrada.module.css";

interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
  terms?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/// Criar conta em uma tela (FIT-164): nome, e-mail e senha com "Mostrar",
/// sem "Confirmar senha", e o aceite dos termos. O papel vem da página
/// (ADR-007), nunca de um campo. Segue para o onboarding do papel.
export function CriarContaForm({ mode = "personal" }: { mode?: "personal" | "individual" }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [terms, setTerms] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    const normalizedEmail = email.trim().toLowerCase();
    const errors: FieldErrors = {};
    if (name.trim().length < 2) errors.name = "Informe seu nome.";
    if (!EMAIL_PATTERN.test(normalizedEmail)) errors.email = "Informe um e-mail válido.";
    if (password.length < 8) errors.password = "Use pelo menos 8 caracteres.";
    if (!terms) errors.terms = "Aceite os termos para continuar.";
    setFieldErrors(errors);
    setFormError(null);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    const { error } = await signUp.email({ name: name.trim(), email: normalizedEmail, password, role: mode === "individual" ? "INDIVIDUAL" : "PERSONAL" });
    setIsSubmitting(false);
    if (error) {
      setFormError("Não foi possível criar a conta. Se você já tem conta com este e-mail, entre por aqui.");
      return;
    }
    router.push(mode === "individual" ? "/onboarding" : "/onboarding-personal");
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {formError ? (
        <FormAlert variant="error">
          {formError} <Link href="/entrar">Entrar</Link>
        </FormAlert>
      ) : null}
      <TextField label="Seu nome" name="name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} error={fieldErrors.name} disabled={isSubmitting} required />
      <TextField label="E-mail" name="email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} error={fieldErrors.email} disabled={isSubmitting} required />
      <PasswordField value={password} onChange={setPassword} error={fieldErrors.password} autoComplete="new-password" disabled={isSubmitting} />
      <label className={styles.check}>
        <input type="checkbox" checked={terms} onChange={(event) => setTerms(event.target.checked)} aria-invalid={fieldErrors.terms ? true : undefined} />
        <span>
          Li e aceito os <Link href="/termos-de-uso">Termos de uso</Link> e a <Link href="/politica-de-privacidade">Política de privacidade</Link>.
        </span>
      </label>
      {fieldErrors.terms ? (
        <p role="alert" className={styles.muted}>
          {fieldErrors.terms}
        </p>
      ) : null}
      <Button type="submit" size="lg" block disabled={isSubmitting}>
        {isSubmitting ? "Criando…" : "Criar conta"}
      </Button>
    </form>
  );
}
