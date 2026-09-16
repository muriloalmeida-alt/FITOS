"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, FormAlert, TextField } from "@/shared/ui";
import styles from "./EditarAlunoForm.module.css";

interface EditarAlunoFormProps {
  studentId: string;
  initialName: string;
  initialEmail: string;
  emailEditavel: boolean;
}

interface FieldErrors {
  name?: string;
  email?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/// Formulário de edição do aluno (FIT-014). O e-mail só é editável antes da
/// ativação da conta (`emailEditavel`, derivado de `student.userId === null`
/// no servidor) — depois da ativação, o campo é somente leitura, com uma
/// explicação, em vez de permitir uma troca silenciosa do e-mail de
/// autenticação (o servidor bloqueia isso de qualquer forma; o campo
/// desabilitado aqui é só para não sugerir uma ação que vai ser rejeitada).
export function EditarAlunoForm({ studentId, initialName, initialEmail, emailEditavel }: EditarAlunoFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const errors: FieldErrors = {};
    if (name.trim().length === 0) {
      errors.name = "Informe o nome do aluno.";
    }
    if (emailEditavel && !EMAIL_PATTERN.test(normalizedEmail)) {
      errors.email = "Informe um e-mail válido.";
    }
    setFieldErrors(errors);
    setFormError(null);
    setFormSuccess(null);

    if (Object.keys(errors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    const response = await fetch(`/api/students/${studentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(emailEditavel ? { name: name.trim(), email: normalizedEmail } : { name: name.trim() }),
    });
    setIsSubmitting(false);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setFormError(body?.message ?? "Não foi possível salvar as alterações. Tente novamente.");
      return;
    }

    setFormSuccess("Alterações salvas.");
    router.refresh();
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {formError ? <FormAlert variant="error">{formError}</FormAlert> : null}
      {formSuccess ? <FormAlert variant="info">{formSuccess}</FormAlert> : null}

      <TextField
        label="Nome completo"
        name="name"
        type="text"
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
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={fieldErrors.email}
        disabled={isSubmitting || !emailEditavel}
        required={emailEditavel}
      />
      {!emailEditavel ? (
        <p className={styles.hint}>
          Este aluno já ativou a conta — o e-mail de autenticação não pode ser alterado por aqui.
        </p>
      ) : null}

      <Button type="submit" variant="filled" disabled={isSubmitting}>
        {isSubmitting ? "Salvando…" : "Salvar alterações"}
      </Button>
    </form>
  );
}
