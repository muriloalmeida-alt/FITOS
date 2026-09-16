import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell, Card } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { AuthError, requirePersonal } from "@/modules/tenancy/authContext";
import { getCatalogExerciseForTenant } from "@/modules/exercises/exercises";
import { LogoutButton } from "../../LogoutButton";
import { PERSONAL_NAV_ITEMS } from "../../navigation";
import { EditarExercicioForm } from "./EditarExercicioForm";
import { ArquivarExercicioButton } from "./ArquivarExercicioButton";
import { ReativarExercicioButton } from "./ReativarExercicioButton";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: `Exercício — ${appName}`,
};

interface ExercicioDetalhePageProps {
  params: Promise<{ id: string }>;
}

/// Detalhe do exercício (FIT-023). Busca sempre pelo catálogo visível ao
/// tenant da sessão (`getCatalogExerciseForTenant`) — um exercício próprio
/// de outro tenant nunca é encontrado, e a resposta (404) não revela se
/// aquele `id` existe em outro tenant. Edição/arquivamento/reativação só
/// aparecem para exercício próprio (`origin === "PERSONAL"`) — nunca para
/// o catálogo global.
export default async function ExercicioDetalhePage({ params }: ExercicioDetalhePageProps) {
  let ctx;
  try {
    ctx = await requirePersonal();
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(error.kind === "UNAUTHENTICATED" ? "/entrar" : "/painel");
    }
    throw error;
  }

  const { id } = await params;
  const exercise = await getCatalogExerciseForTenant({ tenantId: ctx.tenantId, exerciseId: id });
  if (!exercise) {
    notFound();
  }

  const isOwn = exercise.origin === "PERSONAL";

  return (
    <AppShell title={exercise.name} navItems={PERSONAL_NAV_ITEMS} activeKey="exercicios" trailing={<LogoutButton />}>
      <Link href="/painel/exercicios" className={styles.backLink}>
        ← Voltar para o catálogo
      </Link>

      <Card title="Dados do exercício">
        <p className={styles.originLine}>
          Origem:{" "}
          <span className={isOwn ? styles.originPersonal : styles.originGlobal}>{isOwn ? "Meu exercício" : "Global"}</span>
          {isOwn ? (
            <>
              {" · "}Status:{" "}
              <span className={exercise.status === "ATIVO" ? styles.statusAtivo : styles.statusArquivado}>
                {exercise.status === "ATIVO" ? "Ativo" : "Arquivado"}
              </span>
            </>
          ) : null}
        </p>

        {isOwn ? (
          <EditarExercicioForm
            exerciseId={exercise.id}
            initialName={exercise.name}
            initialType={exercise.type ?? ""}
            initialMuscle={exercise.muscle ?? ""}
            initialEquipments={exercise.equipments ?? ""}
            initialInstructions={exercise.instructions ?? ""}
          />
        ) : (
          <dl className={styles.readOnlyFields}>
            <dt>Tipo</dt>
            <dd>{exercise.type ?? "—"}</dd>
            <dt>Músculo principal</dt>
            <dd>{exercise.muscle ?? "—"}</dd>
            <dt>Equipamento</dt>
            <dd>{exercise.equipments ?? "—"}</dd>
            <dt>Dificuldade</dt>
            <dd>{exercise.difficulty ?? "—"}</dd>
            <dt>Instruções</dt>
            <dd>{exercise.instructions ?? "—"}</dd>
            {exercise.safetyInfo ? (
              <>
                <dt>Informações de segurança</dt>
                <dd>{exercise.safetyInfo}</dd>
              </>
            ) : null}
          </dl>
        )}
      </Card>

      {isOwn ? (
        <Card title="Ciclo de vida">
          {exercise.status === "ATIVO" ? (
            <ArquivarExercicioButton exerciseId={exercise.id} />
          ) : (
            <ReativarExercicioButton exerciseId={exercise.id} />
          )}
        </Card>
      ) : null}
    </AppShell>
  );
}
