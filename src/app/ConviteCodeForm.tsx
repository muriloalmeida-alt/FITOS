"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, TextField } from "@/shared/ui";
import styles from "./ConviteCodeForm.module.css";

/// Entrada "sem convite em mãos" da seção 8 do pacote: quem já recebeu um
/// código do próprio personal (normalmente por um link `/ativar-conta?token=...`
/// que o convite já contém) pode colar só o código aqui, sem precisar do
/// link completo. Nunca cria tenant nem conta — só navega para
/// `/ativar-conta`, que já valida o token no servidor (FIT-015). Nenhum
/// contrato novo: reaproveita a página e a validação existentes.
export function ConviteCodeForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) {
      setError("Cole o código recebido do seu personal.");
      return;
    }
    setError(null);
    router.push(`/ativar-conta?token=${encodeURIComponent(trimmed)}`);
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <TextField
        label="Já tem um código de convite?"
        name="conviteCode"
        placeholder="Cole aqui o código enviado pelo seu personal"
        value={code}
        onChange={(event) => setCode(event.target.value)}
        error={error ?? undefined}
        autoComplete="off"
      />
      <Button type="submit" variant="outlined" className={styles.submit}>
        Acessar com o código
      </Button>
    </form>
  );
}
