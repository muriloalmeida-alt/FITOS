import "server-only";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import { featureEnabled } from "@/shared/config/features";
import { getInProgressSessionForStudent } from "@/modules/execution/sessions";
import { getTodayScheduleForStudent } from "@/modules/workouts/workouts";
import { getIndividualHome } from "@/modules/workouts/individualHome";
import type { NavIconName } from "@/shared/ui/NavIcon";

/// Acesso rápido (proposta 7, aprovada em 11/10/2026): as ações do botão +
/// por perfil, calculadas no servidor quando a modal abre. Só leva aos
/// fluxos que já existem; esconder um atalho não substitui a autorização
/// de cada rota.

export interface QuickAction {
  key: string;
  label: string;
  href: string;
  icon: NavIconName;
}

type Who = { role: "PERSONAL" } | { role: "ALUNO"; userId: string } | { role: "INDIVIDUAL"; userId: string; tenantId: string } | { role: "ADMIN" };

/// Personal: exatamente 3, nesta ordem.
const PERSONAL_ACTIONS: QuickAction[] = [
  { key: "aplicar", label: "Aplicar programa", href: "/painel/treinos?aba=programas", icon: "treinos" },
  { key: "montar", label: "Montar treino", href: "/painel/treinos/novo", icon: "novo" },
  { key: "convidar", label: "Convidar aluno", href: "/painel/alunos/convite", icon: "alunos" },
];

export async function quickActionsFor(who: Who, client: PrismaClient = prisma, now = new Date()): Promise<QuickAction[]> {
  if (who.role === "PERSONAL") return PERSONAL_ACTIONS;
  if (who.role === "ALUNO") {
    // Sem vínculo ativo: nada de começar treino (o Início mostra o vínculo).
    const student = await client.student.findUnique({ where: { userId: who.userId }, select: { id: true, tenantId: true, status: true } });
    if (!student || student.status !== "ATIVO") return [];
    const scope = { tenantId: student.tenantId, studentId: student.id };
    const programa = { key: "programa", label: "Meus treinos", href: "/painel/treino", icon: "treinos" as const };
    if (await getInProgressSessionForStudent(scope, client)) return [{ key: "comecar", label: "Continuar treino", href: "/painel/treino/sessao", icon: "inicio" }, programa];
    const schedule = await getTodayScheduleForStudent(scope, client);
    // Treino do dia vai direto; em dia livre, o programa é o seletor existente.
    if (schedule.state === "TREINO_HOJE") return [{ key: "comecar", label: "Começar treino", href: "/painel/treino/sessao", icon: "inicio" }, programa];
    if (schedule.state === "DESCANSO") return [{ key: "comecar", label: "Começar treino", href: "/painel/treino", icon: "inicio" }, programa];
    return [{ key: "comecar", label: "Ver meu programa", href: "/painel/treino", icon: "inicio" }, programa];
  }
  if (who.role === "INDIVIDUAL") {
    const home = await getIndividualHome({ tenantId: who.tenantId, userId: who.userId, now }, client);
    const second = featureEnabled("RETROATIVO")
      ? { key: "registrar", label: "Registrar treino passado", href: "/painel/treinos-realizados/registrar", icon: "evolucao" as const }
      : { key: "treinos", label: "Meus treinos", href: "/painel/meus-treinos", icon: "treinos" as const };
    const first: QuickAction = home.inProgress
      ? { key: "comecar", label: "Continuar treino", href: "/painel/meus-treinos/sessao", icon: "inicio" }
      : home.today
        ? { key: "comecar", label: "Começar treino", href: `/painel/meus-treinos/sessao?treino=${home.today.id}`, icon: "inicio" }
        : { key: "comecar", label: "Escolher programa", href: "/painel/meus-treinos/biblioteca", icon: "inicio" };
    return [first, second];
  }
  return [];
}
