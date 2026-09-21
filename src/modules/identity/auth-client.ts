"use client";

import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import type { auth } from "./auth";

/// Cliente do Better Auth para uso em componentes client-side (formulários
/// de login/cadastro, botão de logout). Nunca usar `better-auth` diretamente
/// em componentes — sempre por este arquivo, mesmo motivo do `auth.ts`
/// server-side: isolar o fornecedor em um único ponto do módulo `identity`.
///
/// `import type { auth }` (nunca um import de valor) é apagado
/// inteiramente pelo TypeScript em tempo de compilação — não traz
/// `auth.ts` (que importa Prisma e é `server-only` de fato por depender de
/// segredos de servidor) para o bundle do cliente. `inferAdditionalFields`
/// só usa esse tipo para tipar `role` em `signUp.email` (FIT-101) — sem
/// isso, o TypeScript rejeitaria passar `role` por não conhecer o campo.
export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof auth>()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
