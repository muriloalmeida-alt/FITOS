import { formatCentsBRL } from "@/shared/lib/money";

const ASSESSMENT_ATTENTION_THRESHOLD_DAYS = 60;
const MAX_ATTENTION_ITEMS = 5;

export interface AttentionCandidateStudent {
  id: string;
  displayName: string;
}

export interface PersonalAttentionInput {
  students: AttentionCandidateStudent[];
  overdueAmountCentsByStudentId: Map<string, number>;
  lastAssessmentAtByStudentId: Map<string, Date>;
  now: Date;
}

export interface PersonalAttentionEntry {
  studentId: string;
  title: string;
  description: string;
  icon: string;
  tone: "neutral" | "warning";
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

/// "Precisa de atenção" do Início do personal (FIT-120, protótipo de
/// referência do redesign mobile-first). Um item por aluno, nunca dois —
/// mensalidade vencida (este mês) tem prioridade sobre avaliação atrasada
/// quando o mesmo aluno acumula os dois sinais, decisão registrada para
/// manter a lista curta e acionável (nunca uma "central de alertas"). Sem
/// nenhuma avaliação registrada ainda é tratado como atenção (nunca
/// confundido com "avaliação em dia"), igual a uma avaliação vencida há
/// muito tempo. Lista sempre limitada a 5 itens — mais que isso deixa de
/// ser um resumo do "hoje" e vira uma segunda lista de alunos.
export function getPersonalAttentionItems(input: PersonalAttentionInput): PersonalAttentionEntry[] {
  const entries: PersonalAttentionEntry[] = [];

  for (const student of input.students) {
    const overdueCents = input.overdueAmountCentsByStudentId.get(student.id);
    if (overdueCents !== undefined && overdueCents > 0) {
      entries.push({
        studentId: student.id,
        title: student.displayName,
        description: `Mensalidade vencida · ${formatCentsBRL(overdueCents)}`,
        icon: "$",
        tone: "warning",
      });
      continue;
    }

    const lastAssessmentAt = input.lastAssessmentAtByStudentId.get(student.id) ?? null;
    if (lastAssessmentAt === null) {
      entries.push({
        studentId: student.id,
        title: student.displayName,
        description: "Avaliação pendente",
        icon: "◎",
        tone: "neutral",
      });
      continue;
    }

    const daysSinceAssessment = daysBetween(lastAssessmentAt, input.now);
    if (daysSinceAssessment >= ASSESSMENT_ATTENTION_THRESHOLD_DAYS) {
      entries.push({
        studentId: student.id,
        title: student.displayName,
        description: `Avaliação há ${daysSinceAssessment} dias`,
        icon: "◎",
        tone: "neutral",
      });
    }
  }

  return entries.slice(0, MAX_ATTENTION_ITEMS);
}
