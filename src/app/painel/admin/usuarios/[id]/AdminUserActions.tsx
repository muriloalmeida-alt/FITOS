"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, FormAlert, TextField } from "@/shared/ui";
import { PasswordField } from "../../../../_entrada/PasswordField";
import styles from "../../admin.module.css";

interface Props {
  user: { id: string; email: string; name: string; hasPassword: boolean };
  canChangePassword: boolean;
  canDelete: boolean;
  losses: string[];
}

/// Nova senha (encerra as sessões do usuário) e exclusão confirmada pelo
/// e-mail digitado.
export function AdminUserActions({ user, canChangePassword, canDelete, losses }: Props) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [passwordStatus, setPasswordStatus] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const confirmed = confirmEmail.trim().toLowerCase() === user.email.toLowerCase();

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingPassword) return;
    if (password.length < 8) {
      setPasswordError("Use pelo menos 8 caracteres.");
      return;
    }
    setPasswordError(undefined);
    setPasswordStatus(null);
    setSavingPassword(true);
    const response = await fetch(`/api/admin/usuarios/${user.id}/senha`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
    setSavingPassword(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setPasswordStatus({ tone: "error", text: body?.message ?? "Não foi possível alterar a senha." });
      return;
    }
    setPassword("");
    setPasswordStatus({ tone: "info", text: `Senha alterada. ${user.name} precisa entrar de novo com a nova senha.` });
    router.refresh();
  }

  async function remove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!confirmed || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    const response = await fetch(`/api/admin/usuarios/${user.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmEmail }) });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setDeleteError(body?.message ?? "Não foi possível excluir. Tente de novo.");
      setDeleting(false);
      return;
    }
    router.push("/painel/admin");
    router.refresh();
  }

  return (
    <>
      {canChangePassword ? (
        <form className={styles.section} onSubmit={changePassword} noValidate aria-labelledby="senha">
          <h2 id="senha">{user.hasPassword ? "Alterar senha" : "Definir senha"}</h2>
          <p className={styles.muted}>A pessoa sai de todos os aparelhos e entra com a nova senha.</p>
          {passwordStatus ? <FormAlert variant={passwordStatus.tone}>{passwordStatus.text}</FormAlert> : null}
          <PasswordField label="Nova senha" value={password} onChange={setPassword} error={passwordError} autoComplete="new-password" disabled={savingPassword} />
          <Button type="submit" size="lg" block disabled={savingPassword}>
            {savingPassword ? "Salvando…" : "Salvar nova senha"}
          </Button>
        </form>
      ) : null}

      {canDelete ? (
        <form className={`${styles.section} ${styles.danger}`} onSubmit={remove} noValidate aria-labelledby="excluir">
          <h2 id="excluir">Excluir usuário</h2>
          <p className={styles.muted}>Não dá para desfazer. Sai junto:</p>
          <ul className={styles.losses}>
            {losses.map((loss) => (
              <li key={loss}>{loss}</li>
            ))}
          </ul>
          {deleteError ? <FormAlert variant="error">{deleteError}</FormAlert> : null}
          <TextField label={`Para confirmar, digite ${user.email}`} name="confirmEmail" type="email" autoComplete="off" value={confirmEmail} onChange={(event) => setConfirmEmail(event.target.value)} disabled={deleting} />
          <Button type="submit" variant="danger" size="lg" block disabled={!confirmed || deleting}>
            {deleting ? "Excluindo…" : "Excluir usuário e tudo o que é dele"}
          </Button>
        </form>
      ) : null}
    </>
  );
}
