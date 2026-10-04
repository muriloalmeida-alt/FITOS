import "server-only";
import { listAssignableStudents, listWorkoutSummariesForTenant, listWorkoutsInPlan } from "@/modules/workouts/workouts";
import type { AssignableStudentOption, AvailableWorkout, ProgramWorkout } from "./ProgramEditor";

/// Dados da tela de programa (FIT-146): treinos do programa na ordem,
/// treinos disponíveis para adicionar e alunos que podem recebê-lo.
export async function loadProgramData(
  tenantId: string,
  planId: string | null
): Promise<{ workouts: ProgramWorkout[]; available: AvailableWorkout[]; students: AssignableStudentOption[] }> {
  const [summaries, inPlan, students] = await Promise.all([
    listWorkoutSummariesForTenant({ tenantId }),
    planId ? listWorkoutsInPlan({ tenantId, trainingPlanId: planId }) : Promise.resolve([]),
    listAssignableStudents({ tenantId }),
  ]);
  const byId = new Map(summaries.map((summary) => [summary.id, summary]));
  const workouts = inPlan.map((workout) => {
    const summary = byId.get(workout.id);
    return {
      id: workout.id,
      name: workout.name,
      suggestedDays: workout.suggestedDays,
      exerciseCount: summary?.exerciseCount ?? 0,
      thumbnail: summary?.thumbnails[0]?.imageUrl ?? null,
    };
  });
  const available = summaries
    .filter((summary) => summary.trainingPlanId !== planId)
    .map((summary) => ({ id: summary.id, name: summary.name, exerciseCount: summary.exerciseCount, inProgramName: summary.trainingPlanName }));
  return { workouts, available, students };
}
