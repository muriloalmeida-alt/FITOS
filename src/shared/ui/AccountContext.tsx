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
/// Assuntos com mensagem não lida no chat (EPIC-39).
const UnreadMessagesContext = createContext<number>(0);

export function AccountNameProvider({ name, image = null, unreadMessages = 0, children }: { name: string | null; image?: string | null; unreadMessages?: number; children: ReactNode }) {
  return (
    <AccountNameContext.Provider value={name}>
      <AccountImageContext.Provider value={image}>
        <UnreadMessagesContext.Provider value={unreadMessages}>{children}</UnreadMessagesContext.Provider>
      </AccountImageContext.Provider>
    </AccountNameContext.Provider>
  );
}

export function useUnreadMessages(): number {
  return useContext(UnreadMessagesContext);
}

export function useAccountName(): string | null {
  return useContext(AccountNameContext);
}

export function useAccountImage(): string | null {
  return useContext(AccountImageContext);
}
