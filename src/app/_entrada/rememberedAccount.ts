"use client";

/// Conta lembrada neste aparelho (EPIC-33): o Entrar mostra "Continuar
/// como Murilo" em vez do formulário vazio. Só nome, e-mail, papel e se
/// este aparelho tem digital/Face ID cadastrado — nunca senha ou token.
export interface RememberedAccount {
  name: string;
  email: string;
  role: "PERSONAL" | "ALUNO" | "INDIVIDUAL" | "ADMIN";
  passkey: boolean;
}

const KEY = "fitos:conta";

export function readRememberedAccount(): RememberedAccount | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<RememberedAccount>;
    if (typeof value.email !== "string" || typeof value.name !== "string") return null;
    return { name: value.name, email: value.email, role: value.role ?? "PERSONAL", passkey: value.passkey === true };
  } catch {
    return null;
  }
}

export function rememberAccount(account: Omit<RememberedAccount, "passkey"> & { passkey?: boolean }): void {
  try {
    const current = readRememberedAccount();
    const passkey = account.passkey ?? (current?.email === account.email ? current.passkey : false);
    window.localStorage.setItem(KEY, JSON.stringify({ ...account, passkey }));
  } catch {
    // Sem armazenamento: o Entrar mostra o formulário normal.
  }
}

export function forgetAccount(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nada a fazer.
  }
}

export const ROLE_LABEL: Record<RememberedAccount["role"], string> = { PERSONAL: "Personal", ALUNO: "Aluno", INDIVIDUAL: "FitOS Livre", ADMIN: "Administrador" };

/// O aparelho tem biometria ou bloqueio de tela para passkey?
export async function platformPasskeyAvailable(): Promise<boolean> {
  try {
    return typeof window !== "undefined" && "PublicKeyCredential" in window && (await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch {
    return false;
  }
}
