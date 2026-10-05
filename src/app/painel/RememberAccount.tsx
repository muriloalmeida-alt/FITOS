"use client";

import { useEffect } from "react";
import { rememberAccount, type RememberedAccount } from "../_entrada/rememberedAccount";

/// Guarda quem está usando este aparelho (EPIC-33), para o Entrar mostrar
/// "Continuar como …" da próxima vez. Inclui quem entrou antes desta
/// mudança.
export function RememberAccount({ account }: { account: Omit<RememberedAccount, "passkey"> | null }) {
  useEffect(() => {
    if (account) rememberAccount(account);
  }, [account]);
  return null;
}
