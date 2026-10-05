"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, FormAlert, TextField } from "@/shared/ui";
import { PasswordField } from "../../_entrada/PasswordField";
import styles from "../../_entrada/Entrada.module.css";

export function JoinByLinkForm({ code }: { code: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const found: Record<string, string> = {};
    if (name.trim().length < 2) found.name = "Informe seu nome.";
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) found.email = "Informe um e-mail válido.";
    if (password.length < 8) found.password = "Use pelo menos 8 caracteres.";
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    setFormError(null);
    const response = await fetch(`/api/convite-link/${code}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), email: email.trim(), password }) });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setFormError(body?.error === "EMAIL_JA_POSSUI_CONTA" ? "Este e-mail já tem conta. Entre com ele e cole o convite no Início." : (body?.message ?? "Não foi possível entrar. Tente de novo."));
      setBusy(false);
      return;
    }
    router.push("/painel");
    router.refresh();
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      {formError ? <FormAlert variant="error">{formError}</FormAlert> : null}
      <TextField label="Seu nome" name="name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} error={errors.name} disabled={busy} />
      <TextField label="E-mail" name="email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} error={errors.email} disabled={busy} />
      <PasswordField label="Crie uma senha" value={password} onChange={setPassword} error={errors.password} autoComplete="new-password" disabled={busy} />
      <Button type="submit" size="lg" block disabled={busy}>
        {busy ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
