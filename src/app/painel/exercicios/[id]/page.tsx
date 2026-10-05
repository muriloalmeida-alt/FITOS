import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Button, ExerciseThumbnail, Tag } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { difficultyLabel } from "@/shared/lib/difficulty";
import { AuthError, requireSubscriber } from "@/modules/tenancy/authContext";
import { getCatalogExerciseForTenant, listCatalogFacets } from "@/modules/exercises/exercises";
import { ExerciseDetailActions } from "./ExerciseDetailActions";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: `Exercício — ${appName}`,
};

/// Divide as instruções em passos curtos (uma frase por passo).
function toSteps(text: string | null): string[] {
  if (!text) return [];
  return text
    .split(/\n+|(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/)
    .map((step) => step.trim())
    .filter(Boolean);
}

/// Detalhe do exercício (FIT-147): foto, etiquetas, "Como executar" em
/// passos, segurança e as ações do contexto — editar/arquivar/reativar o
/// próprio, "Criar uma versão minha" do global e "Usar em um treino".
/// Sempre pelo tenant da sessão: próprio de outro tenant é 404.
export default async function ExercicioPage({ params }: { params: Promise<{ id: string }> }) {
  let ctx;
  try {
    ctx = await requireSubscriber();
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
  const own = exercise.origin === "PERSONAL";
  const facets = own ? await listCatalogFacets({ tenantId: ctx.tenantId }) : { muscles: [], types: [], difficulties: [] };
  const steps = toSteps(exercise.instructions);
  const tags = [exercise.muscle, exercise.equipments, exercise.type, difficultyLabel(exercise.difficulty)].filter((value): value is string => Boolean(value));

  return (
    <div className={styles.page}>
      <div className={styles.top}>
        <Link href="/painel/exercicios" className={styles.back}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
          Exercícios
        </Link>
        <Tag tone={own ? (exercise.status === "ATIVO" ? "accent" : "muted") : "muted"}>{own ? (exercise.status === "ATIVO" ? "Seu exercício" : "Arquivado") : "Biblioteca FitOS"}</Tag>
      </div>
      {exercise.imageUrl ? (
        <ExerciseThumbnail src={exercise.imageUrl} alt={exercise.imageAlt ?? exercise.name} width={680} height={420} priority className={styles.hero} />
      ) : null}
      <h1 className={styles.title}>{exercise.name}</h1>
      {tags.length > 0 ? (
        <ul className={styles.tags} aria-label="Características">
          {tags.map((tag) => (
            <li key={tag}>
              <Tag>{tag}</Tag>
            </li>
          ))}
        </ul>
      ) : null}

      <h2 className={styles.cap}>Como executar</h2>
      {steps.length === 0 ? (
        <p className={styles.muted}>Sem instruções cadastradas.</p>
      ) : (
        <ol className={styles.steps}>
          {steps.map((step, index) => (
            <li key={index} className={styles.step}>
              <span className={styles.stepNumber} aria-hidden="true">
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      )}
      {exercise.safetyInfo ? (
        <>
          <h2 className={styles.cap}>Segurança</h2>
          <p className={styles.warn}>{exercise.safetyInfo}</p>
        </>
      ) : null}

      <ExerciseDetailActions
        exerciseId={exercise.id}
        own={own}
        status={exercise.status}
        initial={{ name: exercise.name, muscle: exercise.muscle, equipments: exercise.equipments, type: exercise.type, instructions: exercise.instructions ?? "" }}
        muscles={facets.muscles}
        types={facets.types}
      />

      <div className={styles.bar}>
        <Button href={ctx.role === "PERSONAL" ? "/painel/treinos/novo" : "/painel/meus-treinos/novo"} block size="lg">
          Usar em um treino
        </Button>
      </div>
    </div>
  );
}
