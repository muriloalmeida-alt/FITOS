import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell, Card } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { AuthError, requireIndividual } from "@/modules/tenancy/authContext";
import { LogoutButton } from "../../LogoutButton";
import { INDIVIDUAL_NAV_ITEMS } from "../../navigation";
import { CriarMeuTreinoForm } from "./CriarMeuTreinoForm";

export const metadata: Metadata = {
  title: `Criar treino — ${appName}`,
};

export default async function CriarMeuTreinoPage() {
  try {
    await requireIndividual();
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(error.kind === "UNAUTHENTICATED" ? "/entrar" : "/painel");
    }
    throw error;
  }

  return (
    <AppShell title="Criar treino" navItems={INDIVIDUAL_NAV_ITEMS} activeKey="treinos" trailing={<LogoutButton />}>
      <Card title="Dados do treino">
        <CriarMeuTreinoForm />
      </Card>
    </AppShell>
  );
}
