"use client";

import { createAuthClient } from "better-auth/react";

/// Cliente do Better Auth para uso em componentes client-side (formulários
/// de login/cadastro, botão de logout). Nunca usar `better-auth` diretamente
/// em componentes — sempre por este arquivo, mesmo motivo do `auth.ts`
/// server-side: isolar o fornecedor em um único ponto do módulo `identity`.
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;
