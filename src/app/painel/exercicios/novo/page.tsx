import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppShell, Card } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { AuthError, requireSubscriber } from "@/modules/tenancy/authContext";
import { LogoutButton } from "../../LogoutButton";
import { INDIVIDUAL_NAV_ITEMS, PERSONAL_NAV_ITEMS } from "../../navigation";
import { CadastrarExercicioForm } from "./CadastrarExercicioForm";

export const metadata: Metadata = {
  title: `Cadastrar exercício — ${appName}`,
};

/// FIT-142: também acessível ao workspace individual (FitOS Livre) — a
/// pedido de Murilo, o aluno Livre passa a poder cadastrar exercícios
/// próprios e incluí-los nos próprios treinos, mesmo formulário e mesma
/// rota já usados pelo personal desde a FIT-022. `activeKey`/`navItems`
/// variam por papel porque o Livre não tem o destino "exercícios" na
/// própria navegação (chega aqui a partir do builder de treino).
export default async function CadastrarExercicioPage() {
  let ctx;
  try {
    ctx = await requireSubscriber();
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(error.kind === "UNAUTHENTICATED" ? "/entrar" : "/painel");
    }
    throw error;
  }

  const navItems = ctx.role === "PERSONAL" ? PERSONAL_NAV_ITEMS : INDIVIDUAL_NAV_ITEMS;
  const activeKey = ctx.role === "PERSONAL" ? "exercicios" : "treinos";

  return (
    <AppShell eyebrow="Cadastrar exercício" title="Novo exercício" subtitle="Dados e orientação de execução." navItems={navItems} activeKey={activeKey} trailing={<LogoutButton />}>
      <Card title="Dados do exercício">
        <Suspense fallback={null}>
          <CadastrarExercicioForm />
        </Suspense>
      </Card>
    </AppShell>
  );
}
