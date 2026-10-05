"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, FormAlert, Sheet, TextField } from "@/shared/ui";
import { authClient, signIn } from "@/modules/identity/auth-client";
import styles from "../_entrada/Entrada.module.css";
import { PasswordField } from "../_entrada/PasswordField";
import { ROLE_LABEL, platformPasskeyAvailable, readRememberedAccount, rememberAccount, type RememberedAccount } from "../_entrada/rememberedAccount";

interface FieldErrors {
  email?: string;
  password?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OFFER_KEY = "fitos:passkey:oferecido";

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")).toUpperCase() || "?";
}

function roleOf(value: unknown): RememberedAccount["role"] {
  return value === "ALUNO" || value === "INDIVIDUAL" || value === "ADMIN" ? value : "PERSONAL";
}

/// Entrar (EPIC-33, E1): quem já entrou neste aparelho vê "Continuar como
/// Murilo" e digita só a senha — ou entra com digital/Face ID (passkey),
/// sem digitar nada. Outra conta: e-mail e senha. Depois de entrar com
/// senha num aparelho com biometria, oferece uma vez ligar o passkey.
export function EntrarForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [known, setKnown] = useState<RememberedAccount | null>(null);
  const [mode, setMode] = useState<"loading" | "known" | "other">("loading");
  const [askPassword, setAskPassword] = useState(false);
  const [canPasskey, setCanPasskey] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [offer, setOffer] = useState(false);

  useEffect(() => {
    const account = readRememberedAccount();
    /* eslint-disable react-hooks/set-state-in-effect -- lê o aparelho depois da hidratação */
    setKnown(account);
    setMode(account ? "known" : "other");
    /* eslint-enable react-hooks/set-state-in-effect */
    void platformPasskeyAvailable().then(setCanPasskey);
  }, []);

  function destination() {
    const redirecionar = searchParams.get("redirecionar");
    return redirecionar && redirecionar.startsWith("/") ? redirecionar : "/painel";
  }

  function go() {
    router.push(destination());
    router.refresh();
  }

  async function passkeySignIn() {
    if (busy) return;
    setBusy(true);
    setFormError(null);
    const result = await signIn.passkey().catch(() => ({ error: { message: "cancelado" } }));
    if (result?.error) {
      setBusy(false);
      setFormError(known?.passkey ? "Não deu certo com a digital. Use sua senha ou tente de novo." : "Este aparelho ainda não tem digital/Face ID ligado para o FitOS. Entre com a senha e ative em seguida.");
      if (mode === "known") setAskPassword(true);
      return;
    }
    const session = await authClient.getSession().catch(() => null);
    const user = session?.data?.user as { name: string; email: string; role?: unknown } | undefined;
    if (user) rememberAccount({ name: user.name, email: user.email, role: roleOf(user.role), passkey: true });
    go();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const normalizedEmail = mode === "known" && known ? known.email : email.trim().toLowerCase();
    const errors: FieldErrors = {};
    if (!EMAIL_PATTERN.test(normalizedEmail)) errors.email = "Informe um e-mail válido.";
    if (password.length === 0) errors.password = "Informe sua senha.";
    setFieldErrors(errors);
    setFormError(null);
    if (Object.keys(errors).length > 0) return;

    setBusy(true);
    const { data, error } = await signIn.email({ email: normalizedEmail, password });
    if (error?.status === 429) {
      // Limite de tentativas do Better Auth: não é senha errada.
      setBusy(false);
      setFormError("Muitas tentativas seguidas. Aguarde alguns segundos e tente de novo.");
      return;
    }
    if (error || !data) {
      // Mensagem deliberadamente genérica: não revela se o e-mail existe.
      setBusy(false);
      setFieldErrors({ password: "E-mail ou senha inválidos. Confira e tente de novo." });
      return;
    }
    const user = data.user as { name: string; email: string; role?: unknown };
    const sameDevice = known?.email === user.email;
    rememberAccount({ name: user.name, email: user.email, role: roleOf(user.role), passkey: sameDevice ? known!.passkey : false });
    let offered = false;
    try {
      offered = window.localStorage.getItem(OFFER_KEY) === user.email;
    } catch {
      offered = true;
    }
    if (canPasskey && !(sameDevice && known!.passkey) && !offered) {
      setBusy(false);
      setOffer(true);
      return;
    }
    go();
  }

  async function enablePasskey() {
    setBusy(true);
    const account = readRememberedAccount();
    const result = await authClient.passkey.addPasskey({ name: "Este aparelho" }).catch(() => ({ error: { message: "cancelado" } }));
    try {
      if (account) window.localStorage.setItem(OFFER_KEY, account.email);
    } catch {
      // Ignora.
    }
    if (!result?.error && account) rememberAccount({ ...account, passkey: true });
    go();
  }

  function later() {
    try {
      const account = readRememberedAccount();
      if (account) window.localStorage.setItem(OFFER_KEY, account.email);
    } catch {
      // Ignora.
    }
    go();
  }

  if (mode === "loading") return <div className={styles.form} aria-hidden />;

  return (
    <>
      {mode === "known" && known ? (
        <div className={styles.form}>
          <button type="button" className={askPassword ? `${styles.option} ${styles.optionOn}` : styles.option} onClick={() => setAskPassword(true)} aria-expanded={askPassword}>
            <span className={styles.accountIni} aria-hidden="true">
              {initials(known.name)}
            </span>
            <span className={styles.optionText}>
              <span className={styles.optionTitle}>Continuar como {known.name.trim().split(/\s+/)[0]}</span>
              <span className={styles.muted}>
                {known.email} · {ROLE_LABEL[known.role]}
              </span>
            </span>
            <span className={styles.chev} aria-hidden="true">›</span>
          </button>
          {formError ? <FormAlert variant="error">{formError}</FormAlert> : null}
          {askPassword ? (
            <form className={styles.form} onSubmit={handleSubmit} aria-busy={busy} noValidate>
              <PasswordField value={password} onChange={setPassword} error={fieldErrors.password} autoComplete="current-password" disabled={busy} />
              <Button type="submit" size="lg" block disabled={busy}>
                {busy ? "Entrando…" : "Entrar"}
              </Button>
            </form>
          ) : null}
          {canPasskey && known.passkey && !askPassword ? (
            <Button type="button" variant="secondary" size="lg" block disabled={busy} onClick={() => void passkeySignIn()}>
              Entrar com digital ou Face ID
            </Button>
          ) : null}
          <Button
            type="button"
            variant="quiet"
            block
            onClick={() => {
              setMode("other");
              setAskPassword(false);
              setFormError(null);
              setFieldErrors({});
            }}
          >
            Entrar com outra conta
          </Button>
        </div>
      ) : (
        <form className={styles.form} onSubmit={handleSubmit} aria-busy={busy} noValidate>
          {formError ? <FormAlert variant="error">{formError}</FormAlert> : null}
          <TextField label="E-mail" name="email" type="email" inputMode="email" autoComplete="username webauthn" placeholder="seu@email.com" value={email} onChange={(event) => setEmail(event.target.value)} error={fieldErrors.email} disabled={busy} required />
          <PasswordField value={password} onChange={setPassword} error={fieldErrors.password} autoComplete="current-password" disabled={busy} />
          <Button type="submit" variant="filled" size="lg" block disabled={busy}>
            {busy ? "Entrando…" : "Entrar"}
          </Button>
          {canPasskey ? (
            <Button type="button" variant="secondary" block disabled={busy} onClick={() => void passkeySignIn()}>
              Entrar com digital ou Face ID
            </Button>
          ) : null}
          {known ? (
            <Button type="button" variant="quiet" block onClick={() => setMode("known")}>
              Voltar para {known.name.trim().split(/\s+/)[0]}
            </Button>
          ) : null}
        </form>
      )}

      <Sheet open={offer} onClose={later} title="Entrar com digital?" description="Da próxima vez, entre com a digital, o Face ID ou o bloqueio do celular. Sem digitar a senha.">
        <div className={styles.form}>
          <Button type="button" size="lg" block disabled={busy} onClick={() => void enablePasskey()}>
            Ativar
          </Button>
          <Button type="button" variant="quiet" block onClick={later}>
            Agora não
          </Button>
        </div>
      </Sheet>
    </>
  );
}

