import type { ReactNode } from "react";
import { getServerSession } from "@/modules/identity/session";
import { AccountNameProvider } from "@/shared/ui/AccountContext";
import { RememberAccount } from "./RememberAccount";

/// Layout de `/painel/*` (AjustesTelas, 29/09/2026): só disponibiliza o nome
/// real da sessão ao avatar do cabeçalho mobile do `AppShell`. Nenhuma
/// decisão de autenticação/papel acontece aqui — cada página continua
/// validando a sessão e o papel no servidor, exatamente como antes.
export default async function PainelLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession();
  const user = session?.user as { name: string; email: string; role?: string } | undefined;
  const role = user?.role === "ALUNO" || user?.role === "INDIVIDUAL" || user?.role === "ADMIN" ? user.role : "PERSONAL";
  return (
    <AccountNameProvider name={session?.user.name ?? null}>
      <RememberAccount account={user ? { name: user.name, email: user.email, role } : null} />
      {children}
    </AccountNameProvider>
  );
}
