import "server-only";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";

/// Metas sugeridas (EPIC-30): em vez de escrever a meta, a pessoa escolhe
/// uma das três, já com um valor razoável tirado dos próprios dados, e
/// ajusta com −/+. A descrição final é montada no cliente com o valor.
export interface GoalSuggestion {
  key: "peso" | "frequencia" | "carga";
  /// Valor inicial e passo do ajuste.
  value: number;
  step: number;
  min: number;
  /// Unidade para montar o texto ("kg" ou "x").
  unit: "kg" | "x";
  /// Exercício da meta de carga.
  exerciseName?: string;
  why: string;
}

const DAY = 86_400_000;

function br(value: number) {
  return String(Math.round(value * 10) / 10).replace(".", ",");
}

export async function suggestGoals(input: { tenantId: string; studentId: string; now?: Date }, client: PrismaClient = prisma): Promise<GoalSuggestion[]> {
  const now = input.now ?? new Date();
  const since = new Date(now.getTime() - 28 * DAY);
  const [lastWeight, sessions, sets] = await Promise.all([
    client.assessment.findFirst({ where: { tenantId: input.tenantId, studentId: input.studentId, deletedAt: null, weightGrams: { not: null } }, orderBy: { recordedAt: "desc" }, select: { weightGrams: true } }),
    client.workoutSession.count({ where: { tenantId: input.tenantId, studentId: input.studentId, status: "CONCLUIDA", startedAt: { gte: since } } }),
    client.workoutSetResult.findMany({
      where: { tenantId: input.tenantId, loadGrams: { not: null }, workoutSession: { studentId: input.studentId } },
      select: { loadGrams: true, workoutExercise: { select: { exercise: { select: { id: true, name: true } } } } },
      orderBy: { completedAt: "desc" },
      take: 400,
    }),
  ]);

  const suggestions: GoalSuggestion[] = [];

  const weightKg = lastWeight?.weightGrams ? lastWeight.weightGrams / 1000 : null;
  suggestions.push({
    key: "peso",
    value: 2,
    step: 0.5,
    min: 0.5,
    unit: "kg",
    why: weightKg ? `Hoje: ${br(weightKg)} kg. Ritmo saudável: cerca de 0,5 kg por mês` : "Ritmo saudável: cerca de 0,5 kg por mês",
  });

  const perWeek = sessions / 4;
  suggestions.push({
    key: "frequencia",
    value: Math.min(6, Math.max(2, Math.ceil(perWeek) + (perWeek >= 1 ? 1 : 0))),
    step: 1,
    min: 1,
    unit: "x",
    why: sessions > 0 ? `Você fez ${br(perWeek)} por semana no último mês` : "Comece com uma rotina que caiba na semana",
  });

  // Carga: o exercício mais registrado, recorde + 5 kg.
  const byExercise = new Map<string, { name: string; count: number; best: number }>();
  for (const set of sets) {
    const exercise = set.workoutExercise.exercise;
    const entry = byExercise.get(exercise.id) ?? { name: exercise.name, count: 0, best: 0 };
    entry.count += 1;
    entry.best = Math.max(entry.best, (set.loadGrams ?? 0) / 1000);
    byExercise.set(exercise.id, entry);
  }
  const top = [...byExercise.values()].sort((a, b) => b.count - a.count)[0];
  if (top && top.best > 0) {
    suggestions.push({ key: "carga", value: Math.round((top.best + 5) * 2) / 2, step: 2.5, min: 2.5, unit: "kg", exerciseName: top.name, why: `Seu recorde hoje é ${br(top.best)} kg` });
  }
  return suggestions;
}
