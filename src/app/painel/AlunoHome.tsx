import { AppShell, Card, WorkoutExerciseCard, WorkoutTodayCard } from "@/shared/ui";
import type { StudentTodaySchedule } from "@/modules/workouts/workouts";
import { LogoutButton } from "./LogoutButton";
import { ALUNO_NAV_ITEMS } from "./navigation";
import styles from "./AlunoHome.module.css";

interface AlunoHomeProps {
  displayName: string;
  tenantName: string;
  personalName: string;
  schedule: StudentTodaySchedule;
  hasInProgressSession: boolean;
}

interface PrescriptionSummaryInput {
  sets: number | null;
  reps: number | null;
  durationSeconds: number | null;
  load: string | null;
  restSeconds: number | null;
}

function prescriptionSummary(item: PrescriptionSummaryInput): string {
  const parts: string[] = [];
  if (item.sets) {
    parts.push(`${item.sets} série${item.sets > 1 ? "s" : ""}`);
  }
  if (item.reps) {
    parts.push(`${item.reps} repetiç${item.reps > 1 ? "ões" : "ão"}`);
  }
  if (item.durationSeconds) {
    parts.push(`${item.durationSeconds}s de duração`);
  }
  if (item.load) {
    parts.push(`carga: ${item.load}`);
  }
  if (item.restSeconds) {
    parts.push(`descanso: ${item.restSeconds}s`);
  }
  return parts.length > 0 ? parts.join(" · ") : "Sem parâmetros de prescrição";
}

function itemMeta(item: PrescriptionSummaryInput & { exercise: { muscle: string | null } }): string {
  const summary = prescriptionSummary(item);
  return item.exercise.muscle ? `${item.exercise.muscle} · ${summary}` : summary;
}

/// Sessão em andamento cuja atribuição não é mais "o treino de hoje" (ex.:
/// aluno começou ontem e ainda não concluiu) — sem o nome do treino
/// disponível aqui (`hasInProgressSession` é só um booleano, mesmo
/// contrato de antes da FIT-120), texto sempre genérico, nunca inventado.
function ContinuarSessaoCard() {
  return (
    <WorkoutTodayCard
      eyebrow="Treino em andamento"
      title="Você tem um treino em andamento"
      description="Continue de onde parou."
      imageSrc="/media/brand/visual-2026/scene-coach.png"
      action={{ label: "Continuar treino em andamento", href: "/painel/treino/sessao" }}
    />
  );
}

function TreinoDeHoje({ schedule, hasInProgressSession }: { schedule: StudentTodaySchedule; hasInProgressSession: boolean }) {
  if (schedule.state === "SEM_PLANO") {
    return (
      <>
        {hasInProgressSession ? <ContinuarSessaoCard /> : null}
        <p className={styles.empty}>Você ainda não tem um programa de treino atribuído. Fale com seu personal.</p>
      </>
    );
  }
  if (schedule.state === "PLANO_ENCERRADO") {
    return (
      <>
        {hasInProgressSession ? <ContinuarSessaoCard /> : null}
        <p className={styles.empty}>
          Seu programa &quot;{schedule.planName}&quot; foi encerrado. Fale com seu personal para receber um novo.
        </p>
      </>
    );
  }
  if (schedule.state === "DESCANSO") {
    return (
      <>
        {hasInProgressSession ? <ContinuarSessaoCard /> : null}
        <p className={styles.empty}>Hoje é dia de descanso. Nenhum treino previsto para hoje.</p>
      </>
    );
  }

  const { workout } = schedule;
  return (
    <>
      <WorkoutTodayCard
        eyebrow="Treino de hoje"
        title={workout.name}
        description="Revise os exercícios abaixo e comece quando estiver pronto."
        meta={`${workout.workoutExercises.length} ${workout.workoutExercises.length === 1 ? "exercício" : "exercícios"}`}
        imageSrc="/media/brand/visual-2026/scene-coach.png"
        action={{
          label: hasInProgressSession ? "Continuar treino em andamento" : "Começar treino",
          href: "/painel/treino/sessao",
        }}
      />

      {workout.workoutExercises.length === 0 ? (
        <p className={styles.empty}>Este treino ainda não tem exercícios.</p>
      ) : (
        <ul className={styles.itemList} aria-label={`Exercícios de ${workout.name}, em ordem`}>
          {workout.workoutExercises.map((item) => (
            <li key={item.id}>
              <WorkoutExerciseCard
                name={item.exercise.name}
                meta={itemMeta(item)}
                thumbnailSrc={item.exercise.imageUrl}
                thumbnailAlt={item.exercise.imageAlt ?? item.exercise.name}
              />
              {item.notes ? <span className={styles.notes}>{item.notes}</span> : null}
              {item.exercise.instructions ? <span className={styles.instructions}>{item.exercise.instructions}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/// "Hoje" real do aluno (FIT-016: vínculo; FIT-040: treino do dia). Deriva
/// tudo da sessão e da atribuição ativa no servidor (`/painel/page.tsx`),
/// nunca de algo que o cliente poderia influenciar. Quatro estados
/// honestos (ver `getTodayScheduleForStudent`) — nenhum treino é simulado.
/// FIT-120: o hero de "Treino de hoje" (`WorkoutTodayCard`) já é a própria
/// ação de começar/continuar a sessão — nenhum botão separado abaixo dele.
/// FIT-134 (pacote visual 2026): `imageSrc` já existia em `WorkoutTodayCard`
/// desde a FIT-120 mas nunca tinha sido usado aqui — agora aponta para
/// `scene-coach.png` ("área do aluno e card de convite" na tabela de
/// assets do pacote), só nos dois estados em que o card já é a ação real
/// (treino atribuído ou sessão em andamento); os estados sem treino nunca
/// mostram o card, então nunca mostram a foto.
export function AlunoHome({ displayName, tenantName, personalName, schedule, hasInProgressSession }: AlunoHomeProps) {
  return (
    <AppShell title="Hoje" subtitle={`Olá, ${displayName}`} navItems={ALUNO_NAV_ITEMS} activeKey="hoje" trailing={<LogoutButton />}>
      <Card title="Seu vínculo">
        <p>
          Personal: <strong>{personalName}</strong>
        </p>
        <p>
          Espaço: <strong>{tenantName}</strong>
        </p>
        <p>
          Estado da conta: <strong>Ativa</strong>
        </p>
      </Card>

      <Card title="Treino de hoje">
        <TreinoDeHoje schedule={schedule} hasInProgressSession={hasInProgressSession} />
      </Card>
    </AppShell>
  );
}
