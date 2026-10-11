/// Ficha de saúde (EPIC-46): PAR-Q (as 7 perguntas gerais do PAR-Q+) e
/// uma anamnese curta. Compartilhado entre o formulário e o servidor.

export const PARQ_QUESTIONS = [
  "Algum médico já disse que você tem problema no coração ou pressão alta?",
  "Você sente dor no peito em repouso, no dia a dia ou quando faz atividade física?",
  "Você perde o equilíbrio por tontura ou desmaiou nos últimos 12 meses?",
  "Você tem outra doença crônica diagnosticada (além de coração ou pressão alta)?",
  "Você toma remédio para alguma doença crônica?",
  "Você tem problema nos ossos, articulações ou músculos que pode piorar com exercício?",
  "Algum médico já disse que você só deve fazer atividade física com supervisão médica?",
] as const;

export const HEALTH_CONDITIONS = [
  { key: "HIPERTENSAO", label: "Pressão alta" },
  { key: "DIABETES", label: "Diabetes" },
  { key: "CARDIACO", label: "Problema cardíaco" },
  { key: "RESPIRATORIO", label: "Asma ou bronquite" },
  { key: "COLESTEROL", label: "Colesterol alto" },
  { key: "ARTICULAR", label: "Problema na coluna ou articulações" },
  { key: "GESTANTE", label: "Gestante" },
] as const;

export const ACTIVITY_LEVELS = [
  { key: "SEDENTARIO", label: "Parado há mais de 3 meses" },
  { key: "IRREGULAR", label: "Treino às vezes" },
  { key: "ATIVO", label: "Treino 3x ou mais por semana" },
] as const;

export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number]["key"];

export interface HealthAnswers {
  parq: boolean[];
  conditions: string[];
  injuries: string;
  medications: string;
  pain: string;
  activity: ActivityLevel | null;
  notes: string;
}

export const EMPTY_HEALTH_ANSWERS: HealthAnswers = { parq: PARQ_QUESTIONS.map(() => false), conditions: [], injuries: "", medications: "", pain: "", activity: null, notes: "" };

export const conditionLabel = (key: string) => HEALTH_CONDITIONS.find((item) => item.key === key)?.label ?? key;
export const activityLabel = (key: string | null) => ACTIVITY_LEVELS.find((item) => item.key === key)?.label ?? null;
