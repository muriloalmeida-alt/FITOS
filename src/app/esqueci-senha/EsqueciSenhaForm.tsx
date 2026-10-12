"use client";

import { useState, type FormEvent } from "react";
import { Button, FormAlert, TextField } from "@/shared/ui";
import { authClient } from "@/modules/identity/auth-client";
import styles from "../_entrada/Entrada.module.css";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/// Pede o link de nova senha. A resposta é sempre a mesma, exista ou não
/// uma conta com o e-mail (não revela quem usa o FitOS).
export function EsqueciSenhaForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const normalized = email.trim().toLowerCase();
    setFormError(null);
    if (!EMAIL_PATTERN.test(normalized)) {
      setError("Informe um e-mail válido.");
      return;
    }
    setError(null);
    setBusy(true);
    const { error: requestError } = await authClient.requestPasswordReset({ email: normalized }).catch(() => ({ error: { status: 0 } }));
    setBusy(false);
    if (requestError?.status === 429) {
      setFormError("Muitos pedidos seguidos. Aguarde um minuto e tente de novo.");
      return;
    }
    if (requestError) {
      setFormError("Não foi possível enviar agora. Confira sua conexão e tente de novo.");
      return;
    }
    setSentTo(normalized);
  }

  if (sentTo) {
    return (
      <div className={styles.form} role="status">
        <p className={styles.lead}>
          Se existir uma conta com <strong>{sentTo}</strong>, o link para criar a senha nova chega em alguns minutos. Confira também a caixa de spam.
        </p>
        <Button href="/entrar" block>
          Voltar para entrar
        </Button>
        <Button type="button" variant="quiet" block onClick={() => setSentTo(null)}>
          Usar outro e-mail
        </Button>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <TextField label="E-mail" name="email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(event) => setEmail(event.target.value)} error={error ?? undefined} required />
      {formError ? <FormAlert>{formError}</FormAlert> : null}
      <Button type="submit" block disabled={busy}>
        {busy ? "Enviando..." : "Enviar link"}
      </Button>
    </form>
  );
}
