import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell, Card } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { AuthError, requirePersonal } from "@/modules/tenancy/authContext";
import { LogoutButton } from "../../LogoutButton";
import { PERSONAL_NAV_ITEMS } from "../../navigation";
import { CadastrarExercicioForm } from "./CadastrarExercicioForm";

export const metadata: Metadata = {
  title: `Cadastrar exercício — ${appName}`,
};

export default async function CadastrarExercicioPage() {
  try {
    await requirePersonal();
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(error.kind === "UNAUTHENTICATED" ? "/entrar" : "/painel");
    }
    throw error;
  }

  return (
    <AppShell title="Cadastrar exercício" navItems={PERSONAL_NAV_ITEMS} activeKey="exercicios" trailing={<LogoutButton />}>
      <Card title="Dados do exercício">
        <CadastrarExercicioForm />
      </Card>
    </AppShell>
  );
}
