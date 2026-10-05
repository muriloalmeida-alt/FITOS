import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell, ExerciseThumbnail, Tag } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { difficultyLabel } from "@/shared/lib/difficulty";
import { AuthError, requireSubscriber } from "@/modules/tenancy/authContext";
import { listCatalogExercises, listCatalogFacets } from "@/modules/exercises/exercises";
import { FilterLinks } from "../_workout-builder/FilterLinks";
import { TrainingTabs } from "../_workout-builder/TrainingTabs";
import { LogoutButton } from "../LogoutButton";
import { INDIVIDUAL_NAV_ITEMS, PERSONAL_NAV_ITEMS } from "../navigation";
import { LibraryControls } from "./LibraryControls";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: `Exercícios — ${appName}`,
};

const PAGE_SIZE = 30;
type Origin = "todos" | "biblioteca" | "meus";

interface ExerciciosPageProps {
  searchParams?: Promise<{ q?: string; origem?: string; musculo?: string; tipo?: string; dificuldade?: string; pagina?: string; novo?: string }>;
}

function hrefWith(base: Record<string, string | undefined>, changes: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...base, ...changes })) if (value) params.set(key, value);
  const qs = params.toString();
  return qs ? `/painel/exercicios?${qs}` : "/painel/exercicios";
}

/// Biblioteca de exercícios do Personal (FIT-147, P5 do protótipo): origem
/// (Todos/Biblioteca/Meus), busca, músculo em chips, tipo e dificuldade em
/// sheet, e cada exercício com foto e etiqueta de origem.
export default async function ExerciciosPage({ searchParams }: ExerciciosPageProps = {}) {
  let ctx;
  try {
    ctx = await requireSubscriber();
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(error.kind === "UNAUTHENTICATED" ? "/entrar" : "/painel");
    }
    throw error;
  }

  const sp = (await searchParams) ?? {};
  const origin: Origin = sp.origem === "biblioteca" || sp.origem === "meus" ? sp.origem : "todos";
  const page = Math.max(1, Number(sp.pagina) || 1);
  const [result, facets] = await Promise.all([
    listCatalogExercises({ tenantId: ctx.tenantId, origin, search: sp.q, muscle: sp.musculo, type: sp.tipo, difficulty: sp.dificuldade, page, pageSize: PAGE_SIZE }),
    listCatalogFacets({ tenantId: ctx.tenantId }),
  ]);
  const base = { q: sp.q, origem: origin === "todos" ? undefined : origin, musculo: sp.musculo, tipo: sp.tipo, dificuldade: sp.dificuldade };
  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));

  return (
    <AppShell eyebrow="Exercícios" title="Sua biblioteca" subtitle={`${result.total} ${result.total === 1 ? "exercício" : "exercícios"} com foto, execução e cuidados.`} navItems={ctx.role === "PERSONAL" ? PERSONAL_NAV_ITEMS : INDIVIDUAL_NAV_ITEMS} activeKey={ctx.role === "PERSONAL" ? "exercicios" : "treinos"} trailing={<LogoutButton />}>
      <TrainingTabs active="exercicios" area={ctx.role === "PERSONAL" ? "personal" : "livre"} />
      <FilterLinks
        label="Origem"
        items={(["todos", "biblioteca", "meus"] as const).map((key) => ({
          label: key === "todos" ? "Todos" : key === "biblioteca" ? "Biblioteca FitOS" : "Meus",
          href: hrefWith(base, { origem: key === "todos" ? undefined : key }),
          active: origin === key,
        }))}
      />
      <LibraryControls muscles={facets.muscles} types={facets.types} difficulties={facets.difficulties} openCreate={sp.novo === "1"} />

      {result.items.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Nenhum resultado</p>
          <p className={styles.meta}>{origin === "meus" ? "Você ainda não cadastrou exercícios próprios." : "Tente outro nome ou limpe os filtros."}</p>
          <Link href="/painel/exercicios" className={styles.link}>
            Limpar filtros
          </Link>
        </div>
      ) : (
        <ul className={styles.list} aria-label="Lista de exercícios">
          {result.items.map((exercise) => {
            const own = exercise.origin === "PERSONAL";
            const meta = [exercise.muscle, exercise.equipments, difficultyLabel(exercise.difficulty)].filter(Boolean).join(" · ");
            return (
              <li key={exercise.id}>
                <Link href={`/painel/exercicios/${exercise.id}`} className={styles.row}>
                  <ExerciseThumbnail src={exercise.imageUrl} alt={exercise.imageAlt ?? ""} width={84} height={84} className={styles.thumb} />
                  <span className={styles.text}>
                    <span className={styles.name}>{exercise.name}</span>
                    {meta ? <span className={styles.meta}>{meta}</span> : null}
                    <span className={styles.tag}>
                      <Tag tone={own ? (exercise.status === "ATIVO" ? "accent" : "muted") : "muted"}>{own ? (exercise.status === "ATIVO" ? "Seu exercício" : "Arquivado") : "Biblioteca FitOS"}</Tag>
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {totalPages > 1 ? (
        <nav className={styles.pagination} aria-label="Paginação">
          {page > 1 ? (
            <Link href={hrefWith(base, { pagina: String(page - 1) })} className={styles.link}>
              ← Anteriores
            </Link>
          ) : (
            <span />
          )}
          <span className={styles.meta}>
            Página {page} de {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={hrefWith(base, { pagina: String(page + 1) })} className={styles.link}>
              Próximos →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </AppShell>
  );
}
