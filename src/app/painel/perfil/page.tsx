import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell, Card } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { getServerSession } from "@/modules/identity/session";
import { AuthError, requireStudent } from "@/modules/tenancy/authContext";
import { LogoutButton } from "../LogoutButton";
import { ALUNO_NAV_ITEMS } from "../navigation";

export const metadata: Metadata = {
  title: `Sua conta — ${appName}`,
};

/// Página de conta do aluno (FIT-016): nome e e-mail, exclusiva do papel
/// ALUNO — `requireStudent()` (FIT-011) garante isso no servidor. Um
/// personal não assume a identidade de um aluno alterando a URL: a mesma
/// checagem que protege as rotas de API protege esta página, e ela nunca
/// aceita nenhum identificador de aluno vindo do cliente (não há parâmetro
/// de rota aqui — o aluno é sempre o da própria sessão).
export default async function PerfilAlunoPage() {
  let session;
  try {
    [session] = await Promise.all([getServerSession(), requireStudent()]);
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(error.kind === "UNAUTHENTICATED" ? "/entrar" : "/painel");
    }
    throw error;
  }

  if (!session) {
    redirect("/entrar");
  }

  return (
    <AppShell title="Sua conta" navItems={ALUNO_NAV_ITEMS} activeKey="perfil" trailing={<LogoutButton />}>
      <Card title="Dados da conta">
        <p>
          Nome: <strong>{session.user.name}</strong>
        </p>
        <p>
          E-mail: <strong>{session.user.email}</strong>
        </p>
      </Card>
    </AppShell>
  );
}
