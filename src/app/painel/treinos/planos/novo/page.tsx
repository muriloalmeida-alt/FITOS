import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell, Card } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { AuthError, requirePersonal } from "@/modules/tenancy/authContext";
import { LogoutButton } from "../../../LogoutButton";
import { PERSONAL_NAV_ITEMS } from "../../../navigation";
import { CriarPlanoForm } from "./CriarPlanoForm";

export const metadata: Metadata = {
  title: `Criar programa — ${appName}`,
};

export default async function CriarPlanoPage() {
  try {
    await requirePersonal();
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(error.kind === "UNAUTHENTICATED" ? "/entrar" : "/painel");
    }
    throw error;
  }

  return (
    <AppShell title="Criar programa" navItems={PERSONAL_NAV_ITEMS} activeKey="treinos" trailing={<LogoutButton />}>
      <Card title="Dados do programa">
        <CriarPlanoForm />
      </Card>
    </AppShell>
  );
}
