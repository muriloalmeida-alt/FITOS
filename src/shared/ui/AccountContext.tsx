"use client";

import { createContext, useContext, type ReactNode } from "react";

/// Nome da pessoa autenticada para o avatar do cabeçalho mobile do
/// `AppShell` (AjustesPainel/AjustesTelas, 29/09/2026: "marca à esquerda e
/// avatar à direita"). Fornecido uma única vez por `src/app/painel/layout.tsx`
/// a partir da sessão real do servidor — nunca um nome ilustrativo das
/// prévias. Sem provedor (ex.: testes de componente), o avatar cai para o
/// ícone neutro de perfil, nunca iniciais inventadas.
const AccountNameContext = createContext<string | null>(null);
/// Foto de perfil da sessão (EPIC-35); nula = iniciais.
const AccountImageContext = createContext<string | null>(null);

export function AccountNameProvider({ name, image = null, children }: { name: string | null; image?: string | null; children: ReactNode }) {
  return (
    <AccountNameContext.Provider value={name}>
      <AccountImageContext.Provider value={image}>{children}</AccountImageContext.Provider>
    </AccountNameContext.Provider>
  );
}

export function useAccountName(): string | null {
  return useContext(AccountNameContext);
}

export function useAccountImage(): string | null {
  return useContext(AccountImageContext);
}
