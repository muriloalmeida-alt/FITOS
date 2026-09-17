import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell, Card } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { AuthError, requirePersonal } from "@/modules/tenancy/authContext";
import { LogoutButton } from "../../LogoutButton";
import { PERSONAL_NAV_ITEMS } from "../../navigation";
import { CriarModeloForm } from "./CriarModeloForm";

export const metadata: Metadata = {
  title: `Criar modelo de treino — ${appName}`,
};

export default async function CriarModeloPage() {
  try {
    await requirePersonal();
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(error.kind === "UNAUTHENTICATED" ? "/entrar" : "/painel");
    }
    throw error;
  }

  return (
    <AppShell title="Criar modelo de treino" navItems={PERSONAL_NAV_ITEMS} activeKey="treinos" trailing={<LogoutButton />}>
      <Card title="Dados do modelo">
        <CriarModeloForm />
      </Card>
    </AppShell>
  );
}
