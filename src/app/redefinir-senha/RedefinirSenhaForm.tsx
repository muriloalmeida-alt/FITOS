"use client";

import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { Button, FormAlert } from "@/shared/ui";
import { authClient } from "@/modules/identity/auth-client";
import styles from "../_entrada/Entrada.module.css";
import { PasswordField } from "../_entrada/PasswordField";

const MIN_LENGTH = 8;

/// Nova senha a partir do link do e-mail. Link vencido ou já usado:
/// explica e oferece pedir outro. Depois de trocar, as outras sessões são
/// encerradas e a pessoa entra com a senha nova.
export function RedefinirSenhaForm() {
  const token = useSearchParams().get("token");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"form" | "invalid" | "done">(token ? "form" : "invalid");
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !token) return;
    setFormError(null);
    if (password.length < MIN_LENGTH) {
      setError(`Use pelo menos ${MIN_LENGTH} caracteres.`);
      return;
    }
    setError(null);
    setBusy(true);
    const { error: resetError } = await authClient.resetPassword({ newPassword: password, token }).catch(() => ({ error: { status: 0, code: "" } }));
    setBusy(false);
    if (!resetError) {
      setStatus("done");
      return;
    }
    if (resetError.status === 400 && /TOKEN/i.test(String((resetError as { code?: string }).code ?? ""))) {
      setStatus("invalid");
      return;
    }
    setFormError("Não foi possível salvar a senha. Tente de novo.");
  }

  if (status === "invalid") {
    return (
      <div className={styles.form} role="alert">
        <p className={styles.lead}>Este link venceu ou já foi usado. Peça um novo e use o link mais recente que chegar no seu e-mail.</p>
        <Button href="/esqueci-senha" block>
          Pedir novo link
        </Button>
      </div>
    );
  }

  if (status === "done") {
    return (
      <div className={styles.form} role="status">
        <p className={styles.lead}>Senha nova salva. Use-a para entrar no FitOS.</p>
        <Button href="/entrar" block>
          Entrar
        </Button>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <PasswordField label="Nova senha" value={password} onChange={setPassword} error={error ?? undefined} autoComplete="new-password" disabled={busy} />
      {formError ? <FormAlert>{formError}</FormAlert> : null}
      <Button type="submit" block disabled={busy}>
        {busy ? "Salvando..." : "Salvar nova senha"}
      </Button>
    </form>
  );
}
