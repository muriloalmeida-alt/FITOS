import { redirect } from "next/navigation";
import { getServerSession } from "@/modules/identity/session";

/// `/` (FIT-125/EPIC-16) deixou de ser a landing comercial (agora em
/// `/conheca`) e passa a só resolver sessão: visitante não autenticado vai
/// para `/entrar`; autenticado vai para `/painel`, que já decide sozinho o
/// dashboard certo por papel real (`PersonalHome`/`AlunoHome`/`IndividualHome`
/// — nenhuma lógica de papel duplicada aqui). `redirect()` roda no servidor
/// antes de qualquer HTML ser enviado — nunca há flash de landing/login
/// durante a verificação. Nunca renderiza nada visível: sempre redireciona.
export default async function RootPage() {
  const session = await getServerSession();

  if (!session) {
    redirect("/entrar");
  }

  redirect("/painel");
}
