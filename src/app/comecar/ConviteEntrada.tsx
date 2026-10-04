"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, TextField } from "@/shared/ui";
import styles from "../_entrada/Entrada.module.css";

/// Aceita o código puro ou o link inteiro do convite (`...?token=XYZ`).
export function tokenFromInvite(code: string): string {
  const trimmed = code.trim();
  const match = /[?&]token=([^&#\s]+)/.exec(trimmed);
  return match ? decodeURIComponent(match[1]!) : trimmed;
}

/// "Tenho convite" (FIT-164): código ou link, segue para ativar o convite.
export function ConviteEntrada() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | undefined>();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = tokenFromInvite(code);
    if (!token) {
      setError("Cole o código ou o link que seu personal mandou.");
      return;
    }
    router.push(`/ativar-conta?token=${encodeURIComponent(token)}`);
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <TextField label="Código ou link do convite" name="convite" autoComplete="off" value={code} onChange={(event) => setCode(event.target.value)} error={error} />
      <Button type="submit" size="lg" block>
        Continuar
      </Button>
    </form>
  );
}
