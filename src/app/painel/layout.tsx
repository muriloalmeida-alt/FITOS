import type { ReactNode } from "react";
import { getServerSession } from "@/modules/identity/session";
import { AccountNameProvider } from "@/shared/ui/AccountContext";

/// Layout de `/painel/*` (AjustesTelas, 29/09/2026): só disponibiliza o nome
/// real da sessão ao avatar do cabeçalho mobile do `AppShell`. Nenhuma
/// decisão de autenticação/papel acontece aqui — cada página continua
/// validando a sessão e o papel no servidor, exatamente como antes.
export default async function PainelLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession();
  return <AccountNameProvider name={session?.user.name ?? null}>{children}</AccountNameProvider>;
}
