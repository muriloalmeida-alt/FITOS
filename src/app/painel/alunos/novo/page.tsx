import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell, Card } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { AuthError, requirePersonal } from "@/modules/tenancy/authContext";
import { LogoutButton } from "../../LogoutButton";
import { PERSONAL_NAV_ITEMS } from "../../navigation";
import { CadastrarAlunoForm } from "./CadastrarAlunoForm";

export const metadata: Metadata = {
  title: `Cadastrar aluno — ${appName}`,
};

export default async function CadastrarAlunoPage() {
  try {
    await requirePersonal();
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(error.kind === "UNAUTHENTICATED" ? "/entrar" : "/painel");
    }
    throw error;
  }

  return (
    <AppShell title="Cadastrar aluno" navItems={PERSONAL_NAV_ITEMS} activeKey="alunos" trailing={<LogoutButton />}>
      <Card title="Dados do aluno">
        <CadastrarAlunoForm />
      </Card>
    </AppShell>
  );
}
