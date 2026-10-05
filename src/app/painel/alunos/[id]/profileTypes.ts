export interface ProfileStudent {
  id: string;
  displayName: string;
  email: string;
  status: "ATIVO" | "INATIVO" | "VINCULO_ENCERRADO";
  hasAccount: boolean;
  sinceLabel: string;
  endedLabel: string | null;
  endReason: string | null;
  /// Objetivo escolhido ao entrar pelo convite (EPIC-33).
  objective?: string | null;
}

export type AccessStatus = "NAO_CONVIDADO" | "CONVITE_PENDENTE" | "CONVITE_EXPIRADO" | "CONVITE_CANCELADO" | "CONTA_ATIVA";

export interface ProfileProgram {
  name: string;
  week: number | null;
  weeks: number | null;
  days: string[];
  /// EPIC-31: o aluno escolheu os próprios dias ("Meus dias").
  daysChosenByStudent?: boolean;
  assignedLabel: string;
}

export interface ProgramChoice {
  id: string;
  name: string;
  durationWeeks: number | null;
  workoutCount: number;
  days: string[];
}

export interface ProfileAssessment {
  id: string;
  dateLabel: string;
  weightKg: number | null;
  bodyFatPercent: number | null;
  notes: string | null;
  measurements: { type: string; valueCm: number }[];
}

export interface ProfileCharge {
  id: string;
  description: string;
  amountCents: number;
  status: "PENDENTE" | "ATRASADO" | "PAGO" | "CANCELADO";
  dueLabel: string;
  paidLabel: string | null;
}

export interface ProfileSession {
  id: string;
  workoutName: string;
  dateLabel: string;
  status: "CONCLUIDA" | "ABANDONADA";
  perceivedEffort: number | null;
}

export interface TimelineEntry {
  id: string;
  kind: "treino" | "avaliacao" | "pagamento";
  title: string;
  meta: string;
}
