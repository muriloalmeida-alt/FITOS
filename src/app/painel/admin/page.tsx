import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionRow, AppShell, Avatar, Tag } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { AuthError, requireAdmin } from "@/modules/tenancy/authContext";
import { listUsersForAdmin } from "@/modules/admin/users";
import { FilterLinks } from "../_workout-builder/FilterLinks";
import { RosterSearch } from "../alunos/RosterSearch";
import { LogoutButton } from "../LogoutButton";
import { ADMIN_NAV_ITEMS } from "../navigation";
import { ROLE_FILTERS, ROLE_LABELS, ROLE_TONES } from "./roles";
import styles from "./admin.module.css";

export const metadata: Metadata = { title: `Usuários — ${appName}` };

const dateFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Sao_Paulo" });

interface AdminPageProps {
  searchParams?: Promise<{ q?: string; papel?: string; pagina?: string }>;
}

/// Administração: todos os usuários da plataforma, com busca por nome ou
/// e-mail e filtro por papel. Cada linha abre o usuário (senha e exclusão).
export default async function AdminPage({ searchParams }: AdminPageProps = {}) {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthError) redirect(error.kind === "UNAUTHENTICATED" ? "/entrar" : "/painel");
    throw error;
  }

  const sp = (await searchParams) ?? {};
  const filter = ROLE_FILTERS.find((item) => item.key === sp.papel) ?? ROLE_FILTERS[0]!;
  const result = await listUsersForAdmin({ query: sp.q, role: filter.role, page: Number(sp.pagina) || 1 });
  const href = (changes: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({ papel: filter.key === "todos" ? undefined : filter.key, q: sp.q, ...changes })) if (value) params.set(key, value);
    return params.toString() ? `/painel/admin?${params}` : "/painel/admin";
  };

  return (
    <AppShell eyebrow="Administração" title="Usuários" subtitle={`${result.total} ${result.total === 1 ? "conta" : "contas"}`} navItems={ADMIN_NAV_ITEMS} activeKey="usuarios" trailing={<LogoutButton />}>
      <RosterSearch />
      <FilterLinks label="Filtrar por papel" items={ROLE_FILTERS.map((item) => ({ label: item.label, href: href({ papel: item.key === "todos" ? undefined : item.key }), active: item.key === filter.key }))} />

      {result.users.length === 0 ? (
        <p className={styles.empty}>{sp.q ? "Ninguém com esse nome ou e-mail." : "Nenhuma conta aqui."}</p>
      ) : (
        <ul className={styles.list} aria-label="Lista de usuários">
          {result.users.map((user) => (
            <li key={user.id}>
              <ActionRow
                href={`/painel/admin/usuarios/${user.id}`}
                leading={<Avatar name={user.name} />}
                title={
                  <>
                    {user.name} <Tag tone={ROLE_TONES[user.role]}>{ROLE_LABELS[user.role]}</Tag>
                  </>
                }
                description={[user.email, user.spaceName, `desde ${dateFmt.format(user.createdAt)}`].filter(Boolean).join(" · ")}
                trailing={<span aria-hidden="true">›</span>}
              />
            </li>
          ))}
        </ul>
      )}

      {result.pages > 1 ? (
        <nav className={styles.pager} aria-label="Páginas">
          {result.page > 1 ? <Link href={href({ pagina: String(result.page - 1) })}>Anterior</Link> : <span />}
          <span>
            Página {result.page} de {result.pages}
          </span>
          {result.page < result.pages ? <Link href={href({ pagina: String(result.page + 1) })}>Próxima</Link> : <span />}
        </nav>
      ) : null}
    </AppShell>
  );
}
