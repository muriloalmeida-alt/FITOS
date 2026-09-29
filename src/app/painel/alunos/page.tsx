import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { StudentStatus } from "@prisma/client";
import { AppShell, Button, StudentCard, type StudentCardStatusTone } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { AuthError, requirePersonal } from "@/modules/tenancy/authContext";
import { listStudents } from "@/modules/students/students";
import { getWeeklyRhythmForStudent } from "@/modules/workouts/workouts";
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

/// Rótulo e tom de cada status real de `Student` (nunca inventa um quarto
/// estado): `VINCULO_ENCERRADO` só aparece na aba "Todos" — não tem aba
/// própria porque, diferente de ativo/inativo, é definitivo (FIT-014).
function statusPresentation(status: StudentStatus): { label: string; tone: StudentCardStatusTone } {
  switch (status) {
    case "ATIVO":
      return { label: "Ativo", tone: "positive" };
    case "INATIVO":
      return { label: "Inativo", tone: "neutral" };
    case "VINCULO_ENCERRADO":
      return { label: "Vínculo encerrado", tone: "neutral" };
  }
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
  // FIT-014: a lista padrão (sem filtro explícito) mostra apenas alunos
  // ATIVO — aluno inativado deixa de aparecer por padrão. "todos" é um
  // valor de filtro explícito (não um StudentStatus real) para o personal
  // pedir a carteira completa.
  const statusParam = firstValue(params.status);
  const showingAll = statusParam === "todos";
  const status: StudentStatus | undefined = showingAll
    ? undefined
    : statusParam && VALID_STATUS.includes(statusParam as StudentStatus)
      ? (statusParam as StudentStatus)
      : "ATIVO";
  const pageParam = Number.parseInt(firstValue(params.page) ?? "1", 10);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  const [result, ativoTotal, inativoTotal, todosTotal] = await Promise.all([
    listStudents({ tenantId: ctx.tenantId, search, status, page, pageSize: PAGE_SIZE }),
    listStudents({ tenantId: ctx.tenantId, status: "ATIVO", pageSize: 1 }),
    listStudents({ tenantId: ctx.tenantId, status: "INATIVO", pageSize: 1 }),
    listStudents({ tenantId: ctx.tenantId, pageSize: 1 }),
  ]);
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  // Ritmo semanal real por aluno (FIT-137, tela-07) — só para a página
  // atual (no máximo `PAGE_SIZE` alunos), nunca a carteira inteira.
  // `targetDays` vem `null` para quem não tem plano ativo (inativo,
  // vínculo encerrado, ainda sem atribuição) — nesse caso `StudentCard`
  // simplesmente não recebe `weeklyRhythm`, sem barra fabricada.
  const weeklyRhythmByStudentId = new Map<string, { completedDays: number; targetDays: number }>();
  await Promise.all(
    result.items.map(async (student) => {
      const rhythm = await getWeeklyRhythmForStudent({ tenantId: ctx.tenantId, studentId: student.id });
      if (rhythm.targetDays !== null) {
        weeklyRhythmByStudentId.set(student.id, { completedDays: rhythm.completedDays, targetDays: rhythm.targetDays });
      }
    })
  );

  const hasFilter = Boolean(search) || status === "INATIVO" || showingAll;

  // Distingue "não há nenhum aluno" de "há alunos, mas todos inativos e a
  // lista padrão só mostra ativos" — evita uma mensagem de estado vazio
  // enganosa quando a carteira não está realmente vazia.
  const onlyInactiveHidden = result.total === 0 && !hasFilter ? todosTotal.total > 0 : false;

  function pageHref(targetPage: number): string {
    const next = new URLSearchParams();
    if (search) next.set("q", search);
    if (statusParam) next.set("status", statusParam);
    next.set("page", String(targetPage));
    return `/painel/alunos?${next.toString()}`;
  }

  // Segmentos sempre reiniciam para a página 1 e preservam a busca ativa
  // (`docs/03-design/COMPONENT-LIBRARY.md` — navegação real de servidor,
  // nunca um toggle só de cliente). "todos" continua sendo um valor de
  // filtro explícito, não um `StudentStatus` real (mesma decisão da FIT-013).
  function segmentHref(segmentStatusParam: string | undefined): string {
    const next = new URLSearchParams();
    if (search) next.set("q", search);
    if (segmentStatusParam) next.set("status", segmentStatusParam);
    return `/painel/alunos?${next.toString()}`;
  }
  const segments: { key: string; label: string; count: number; href: string; active: boolean }[] = [
    { key: "ativos", label: "Ativos", count: ativoTotal.total, href: segmentHref(undefined), active: !showingAll && status === "ATIVO" },
    { key: "inativos", label: "Inativos", count: inativoTotal.total, href: segmentHref("INATIVO"), active: status === "INATIVO" },
    { key: "todos", label: "Todos", count: todosTotal.total, href: segmentHref("todos"), active: showingAll },
  ];

  return (
    <AppShell eyebrow="Alunos" title="Alunos" subtitle="Acompanhe cada pessoa em movimento." navItems={PERSONAL_NAV_ITEMS} activeKey="alunos" trailing={<LogoutButton />}>
      <div className={styles.header}>
        <p className={styles.subtitle}>
          {result.total} {result.total === 1 ? "aluno" : "alunos"} na sua carteira
        </p>
        <Button href="/painel/alunos/novo" variant="filled">
          + Cadastrar aluno
        </Button>
      </div>

      <Link href="/painel/alunos/novo" className={styles.inviteCard}>
        <p className={styles.inviteTitle}>+ Convidar ou cadastrar aluno</p>
        <p className={styles.inviteDescription}>Comece uma nova jornada</p>
      </Link>

      <form method="GET" className={styles.filters} aria-label="Buscar alunos">
        <input
          type="search"
          name="q"
          defaultValue={search ?? ""}
          placeholder="Buscar por nome ou e-mail"
          aria-label="Buscar por nome ou e-mail"
          className={styles.searchInput}
        />
        {statusParam ? <input type="hidden" name="status" value={statusParam} /> : null}
        <Button type="submit" variant="outlined">
          Buscar
        </Button>
      </form>

      <div className={styles.segmented} role="tablist" aria-label="Filtrar por status">
        {segments.map((segment) => (
          <Link
            key={segment.key}
            href={segment.href}
            role="tab"
            aria-selected={segment.active}
            className={segment.active ? `${styles.segment} ${styles.segmentActive}` : styles.segment}
          >
            {segment.label} {segment.count}
          </Link>
        ))}
      </div>

      {result.items.length === 0 ? (
        <p className={styles.empty}>
          {onlyInactiveHidden
            ? "Todos os seus alunos estão inativos. Selecione \"Todos\" ou \"Inativos\" para vê-los."
            : hasFilter
              ? "Nenhum resultado para essa busca."
              : "Nenhum aluno cadastrado ainda."}
        </p>
      ) : (
        <div className={styles.list} aria-label="Lista de alunos">
          {result.items.map((student) => {
            const presentation = statusPresentation(student.status);
            return (
              <StudentCard
                key={student.id}
                name={student.displayName}
                description={student.email}
                statusLabel={presentation.label}
                statusTone={presentation.tone}
                href={`/painel/alunos/${student.id}`}
                weeklyRhythm={weeklyRhythmByStudentId.get(student.id)}
              />
            );
          })}
        </div>
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
