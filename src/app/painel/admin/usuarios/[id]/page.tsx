import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell, Tag } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { AuthError, requireAdmin } from "@/modules/tenancy/authContext";
import { AdminError, getUserForAdmin } from "@/modules/admin/users";
import { LogoutButton } from "../../../LogoutButton";
import { ADMIN_NAV_ITEMS } from "../../../navigation";
import { ROLE_LABELS, ROLE_TONES } from "../../roles";
import { AdminUserActions } from "./AdminUserActions";
import styles from "../../admin.module.css";

export const metadata: Metadata = { title: `Usuário — ${appName}` };

const dateFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });

/// Um usuário na administração: o que ele tem na plataforma, nova senha e
/// exclusão com tudo o que é dele.
export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch (error) {
    if (error instanceof AuthError) redirect(error.kind === "UNAUTHENTICATED" ? "/entrar" : "/painel");
    throw error;
  }

  const { id } = await params;
  let user;
  try {
    user = await getUserForAdmin(id);
  } catch (error) {
    if (error instanceof AdminError && error.kind === "NAO_ENCONTRADO") notFound();
    throw error;
  }

  const isOwnSpace = user.role === "PERSONAL" || user.role === "INDIVIDUAL";
  const facts: { label: string; value: string | number }[] = [
    ...(user.role === "PERSONAL" ? [{ label: "Alunos", value: user.counts.students }] : []),
    ...(isOwnSpace ? [{ label: "Programas", value: user.counts.trainingPlans }] : []),
    { label: "Treinos feitos", value: user.counts.workoutSessions },
    { label: "Avaliações", value: user.counts.assessments },
    ...(user.role !== "INDIVIDUAL" ? [{ label: "Cobranças", value: user.counts.charges }] : []),
  ];
  const losses =
    user.role === "ALUNO"
      ? ["O cadastro no espaço do personal", "Todos os treinos feitos e séries registradas", "Avaliações, medidas e metas", "As cobranças e pagamentos deste aluno"]
      : isOwnSpace
        ? [
            "O espaço inteiro, com programas, treinos e exercícios próprios",
            ...(user.role === "PERSONAL" ? ["Os alunos do espaço, com treinos feitos, avaliações e cobranças (as contas deles continuam, sem vínculo)"] : ["Todos os treinos feitos, avaliações, medidas e metas"]),
            "A assinatura do FitOS, cancelada também no Asaas",
          ]
        : [];

  return (
    <AppShell eyebrow="Administração" title={user.name} subtitle={user.email} navItems={ADMIN_NAV_ITEMS} activeKey="usuarios" trailing={<LogoutButton />}>
      <Link href="/painel/admin" className={styles.back}>
        ← Usuários
      </Link>
      <p className={styles.muted}>
        <Tag tone={ROLE_TONES[user.role]}>{ROLE_LABELS[user.role]}</Tag> {user.spaceName ? `${user.spaceName} · ` : ""}conta criada em {dateFmt.format(user.createdAt)}
        {user.subscription ? ` · ${user.subscription.planName} (${user.subscription.status.toLowerCase()})` : ""}
        {user.studentStatus && user.studentStatus !== "ATIVO" ? ` · vínculo ${user.studentStatus === "INATIVO" ? "pausado" : "encerrado"}` : ""}
      </p>
      {user.role !== "ADMIN" ? (
        <dl className={styles.facts}>
          {facts.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <AdminUserActions
        user={{ id: user.id, email: user.email, name: user.name, hasPassword: user.hasPassword }}
        canChangePassword={user.role !== "ADMIN" || user.id === ctx.userId}
        canDelete={user.role !== "ADMIN" && user.id !== ctx.userId}
        losses={losses}
      />
    </AppShell>
  );
}
