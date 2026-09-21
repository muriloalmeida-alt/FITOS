import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell, Button } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { AuthError, requirePersonal } from "@/modules/tenancy/authContext";
import { listCatalogExercises } from "@/modules/exercises/exercises";
import { LogoutButton } from "../LogoutButton";
import { PERSONAL_NAV_ITEMS } from "../navigation";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: `Exercícios — ${appName}`,
};

const PAGE_SIZE = 20;

interface ExerciciosPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/// Catálogo unificado (FIT-023): consulta exclusivamente o banco local
/// (`listCatalogExercises`) — nunca a API Ninjas na consulta usual, por
/// isso continua funcionando mesmo com o fornecedor externo indisponível.
/// Protegida por `requirePersonal()`, a mesma camada de autorização de
/// toda rota de personal desta aplicação.
export default async function ExerciciosPage({ searchParams }: ExerciciosPageProps) {
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
  const muscle = firstValue(params.muscle)?.trim() || undefined;
  const type = firstValue(params.type)?.trim() || undefined;
  const difficulty = firstValue(params.difficulty)?.trim() || undefined;
  const pageParam = Number.parseInt(firstValue(params.page) ?? "1", 10);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  const result = await listCatalogExercises({ tenantId: ctx.tenantId, search, muscle, type, difficulty, page, pageSize: PAGE_SIZE });
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const hasFilter = Boolean(search || muscle || type || difficulty);

  function pageHref(targetPage: number): string {
    const next = new URLSearchParams();
    if (search) next.set("q", search);
    if (muscle) next.set("muscle", muscle);
    if (type) next.set("type", type);
    if (difficulty) next.set("difficulty", difficulty);
    next.set("page", String(targetPage));
    return `/painel/exercicios?${next.toString()}`;
  }

  return (
    <AppShell title="Exercícios" navItems={PERSONAL_NAV_ITEMS} activeKey="exercicios" trailing={<LogoutButton />}>
      <div className={styles.header}>
        <p className={styles.subtitle}>
          {result.total} {result.total === 1 ? "exercício" : "exercícios"} no catálogo
        </p>
        <Button href="/painel/exercicios/novo" variant="filled">
          + Cadastrar exercício
        </Button>
      </div>

      <form method="GET" className={styles.filters} aria-label="Buscar e filtrar exercícios">
        <input
          type="search"
          name="q"
          defaultValue={search ?? ""}
          placeholder="Buscar por nome"
          aria-label="Buscar por nome"
          className={styles.searchInput}
        />
        <input
          type="text"
          name="muscle"
          defaultValue={muscle ?? ""}
          placeholder="Músculo"
          aria-label="Filtrar por músculo"
          className={styles.filterSelect}
        />
        <input
          type="text"
          name="type"
          defaultValue={type ?? ""}
          placeholder="Tipo"
          aria-label="Filtrar por tipo"
          className={styles.filterSelect}
        />
        <input
          type="text"
          name="difficulty"
          defaultValue={difficulty ?? ""}
          placeholder="Dificuldade"
          aria-label="Filtrar por dificuldade"
          className={styles.filterSelect}
        />
        <Button type="submit" variant="outlined">
          Buscar
        </Button>
      </form>

      {result.items.length === 0 ? (
        <p className={styles.empty}>
          {hasFilter
            ? "Nenhum resultado para essa busca."
            : "Nenhum exercício no catálogo ainda. Cadastre um exercício próprio para começar."}
        </p>
      ) : (
        <ul className={styles.list} aria-label="Lista de exercícios">
          {result.items.map((exercise) => (
            <li key={exercise.id}>
              <Link href={`/painel/exercicios/${exercise.id}`} className={styles.row}>
                <span className={styles.cellName}>{exercise.name}</span>
                <span className={styles.cellMuscle}>{exercise.muscle ?? "—"}</span>
                <span className={exercise.origin === "API_NINJAS" ? `${styles.originBadge} ${styles.originGlobal}` : `${styles.originBadge} ${styles.originPersonal}`}>
                  {exercise.origin === "API_NINJAS" ? "Global" : "Meu exercício"}
                </span>
              </Link>
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
