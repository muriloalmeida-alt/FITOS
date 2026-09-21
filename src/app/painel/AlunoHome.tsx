import { AppShell, Button, Card } from "@/shared/ui";
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

function TreinoDeHoje({ schedule }: { schedule: StudentTodaySchedule }) {
  if (schedule.state === "SEM_PLANO") {
    return <p className={styles.empty}>Você ainda não tem um programa de treino atribuído. Fale com seu personal.</p>;
  }
  if (schedule.state === "PLANO_ENCERRADO") {
    return (
      <p className={styles.empty}>
        Seu programa &quot;{schedule.planName}&quot; foi encerrado. Fale com seu personal para receber um novo.
      </p>
    );
  }
  if (schedule.state === "DESCANSO") {
    return <p className={styles.empty}>Hoje é dia de descanso. Nenhum treino previsto para hoje.</p>;
  }

  const { workout } = schedule;
  return (
    <>
      <p className={styles.workoutName}>{workout.name}</p>
      {workout.workoutExercises.length === 0 ? (
        <p className={styles.empty}>Este treino ainda não tem exercícios.</p>
      ) : (
        <ul className={styles.itemList} aria-label={`Exercícios de ${workout.name}, em ordem`}>
          {workout.workoutExercises.map((item) => (
            <li key={item.id} className={styles.itemRow}>
              <span className={styles.exerciseName}>{item.exercise.name}</span>
              {item.exercise.muscle ? <span className={styles.exerciseMuscle}>{item.exercise.muscle}</span> : null}
              <span className={styles.summary}>{prescriptionSummary(item)}</span>
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
export function AlunoHome({ displayName, tenantName, personalName, schedule, hasInProgressSession }: AlunoHomeProps) {
  const podeIrParaSessao = hasInProgressSession || schedule.state === "TREINO_HOJE";

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
        <TreinoDeHoje schedule={schedule} />
        {podeIrParaSessao ? (
          <Button href="/painel/treino/sessao" variant="filled" className={styles.startSessionLink}>
            {hasInProgressSession ? "Continuar treino em andamento" : "Começar treino"}
          </Button>
        ) : null}
      </Card>
    </AppShell>
  );
}
