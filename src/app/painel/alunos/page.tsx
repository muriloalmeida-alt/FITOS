import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { StudentStatus } from "@prisma/client";
import { AppShell, Button } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { AuthError, requirePersonal } from "@/modules/tenancy/authContext";
import { listStudents } from "@/modules/students/students";
import { LogoutButton } from "../LogoutButton";
import { PERSONAL_NAV_ITEMS } from "../navigation";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: `Alunos — ${appName}`,
};

const PAGE_SIZE = 20;
const VALID_STATUS: StudentStatus[] = ["ATIVO", "INATIVO"];

interface AlunosPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/// Página "Alunos" do shell do personal (FIT-013): primeira funcionalidade
/// de negócio real do FitOS. Protegida por `requirePersonal()` — a mesma
/// camada de autorização da FIT-011, nunca por um `tenantId` de query
/// string (não existe esse parâmetro aqui).
export default async function AlunosPage({ searchParams }: AlunosPageProps) {
  let ctx;
  try {
    ctx = await requirePersonal();
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(error.kind === "UNAUTHENTICATED" ? "/entrar" : "/painel");
    }
    throw error;
  }

  const params = await searchParams;
  const search = firstValue(params.q)?.trim() || undefined;
  const statusParam = firstValue(params.status);
  const status = statusParam && VALID_STATUS.includes(statusParam as StudentStatus) ? (statusParam as StudentStatus) : undefined;
  const pageParam = Number.parseInt(firstValue(params.page) ?? "1", 10);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  const result = await listStudents({ tenantId: ctx.tenantId, search, status, page, pageSize: PAGE_SIZE });
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  const hasFilter = Boolean(search || status);

  function pageHref(targetPage: number): string {
    const next = new URLSearchParams();
    if (search) next.set("q", search);
    if (status) next.set("status", status);
    next.set("page", String(targetPage));
    return `/painel/alunos?${next.toString()}`;
  }

  return (
    <AppShell title="Alunos" navItems={PERSONAL_NAV_ITEMS} activeKey="alunos" trailing={<LogoutButton />}>
      <div className={styles.header}>
        <p className={styles.subtitle}>
          {result.total} {result.total === 1 ? "aluno" : "alunos"} na sua carteira
        </p>
        <Link href="/painel/alunos/novo">
          <Button type="button" variant="filled">
            + Cadastrar aluno
          </Button>
        </Link>
      </div>

      <form method="GET" className={styles.filters} aria-label="Buscar e filtrar alunos">
        <input
          type="search"
          name="q"
          defaultValue={search ?? ""}
          placeholder="Buscar por nome ou e-mail"
          aria-label="Buscar por nome ou e-mail"
          className={styles.searchInput}
        />
        <select name="status" defaultValue={status ?? ""} aria-label="Filtrar por status" className={styles.statusSelect}>
          <option value="">Todos os status</option>
          <option value="ATIVO">Ativo</option>
          <option value="INATIVO">Inativo</option>
        </select>
        <Button type="submit" variant="outlined">
          Buscar
        </Button>
      </form>

      {result.items.length === 0 ? (
        <p className={styles.empty}>
          {hasFilter ? "Nenhum resultado para essa busca." : "Nenhum aluno cadastrado ainda."}
        </p>
      ) : (
        <ul className={styles.list} aria-label="Lista de alunos">
          {result.items.map((student) => (
            <li key={student.id} className={styles.row}>
              <span className={styles.cellName}>{student.displayName}</span>
              <span className={styles.cellEmail}>{student.email}</span>
              <span className={student.status === "ATIVO" ? styles.statusAtivo : styles.statusInativo}>
                {student.status === "ATIVO" ? "Ativo" : "Inativo"}
              </span>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 ? (
        <nav className={styles.pagination} aria-label="Paginação">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className={styles.pageLink}>
              Anterior
            </Link>
          ) : (
            <span className={styles.pageLinkDisabled}>Anterior</span>
          )}
          <span className={styles.pageIndicator}>
            Página {page} de {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={pageHref(page + 1)} className={styles.pageLink}>
              Próxima
            </Link>
          ) : (
            <span className={styles.pageLinkDisabled}>Próxima</span>
          )}
        </nav>
      ) : null}
    </AppShell>
  );
}
