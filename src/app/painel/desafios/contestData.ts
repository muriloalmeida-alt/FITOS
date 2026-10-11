import "server-only";
import type { ContestableWorkout, ReviewCase } from "@/modules/gamification/scoreContests";
import type { WorkoutForContest } from "./ContestSheet";
import type { ReviewCaseView } from "./ReviewQueue";

/// Serializa para o cliente (datas como ISO), só o resumo mínimo.
export function workoutsView(map: Map<string, ContestableWorkout[]>): Record<string, WorkoutForContest[]> {
  return Object.fromEntries([...map].map(([key, list]) => [key, list.map((workout) => ({ scoreId: workout.scoreId, performedAtIso: workout.performedAt.toISOString(), pointsTenths: workout.pointsTenths, status: workout.status, contestable: workout.contestable }))]));
}

export function reviewCasesView(cases: ReviewCase[]): ReviewCaseView[] {
  return cases.map((item) => ({ id: item.id, where: item.where, isAppeal: item.isAppeal, ownerName: item.ownerName, performedAtIso: item.performedAt.toISOString(), pointsTenths: item.pointsTenths, reason: item.reason, openedAtIso: item.openedAt.toISOString(), evidenceIds: item.evidenceIds }));
}
