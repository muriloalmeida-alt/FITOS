import { describe, expect, it } from "vitest";
import { formatCentsBRL } from "@/shared/lib/money";
import { getPersonalAttentionItems } from "./getPersonalAttentionItems";

const NOW = new Date("2026-09-27T12:00:00.000Z");

describe("getPersonalAttentionItems", () => {
  it("sinaliza mensalidade vencida com o valor formatado", () => {
    const result = getPersonalAttentionItems({
      students: [{ id: "s1", displayName: "Diego Santos" }],
      overdueAmountCentsByStudentId: new Map([["s1", 32000]]),
      lastAssessmentAtByStudentId: new Map(),
      now: NOW,
    });

    expect(result).toEqual([
      { studentId: "s1", title: "Diego Santos", description: `Mensalidade vencida · ${formatCentsBRL(32000)}`, icon: "$", tone: "warning" },
    ]);
  });

  it("sinaliza aluno nunca avaliado como 'Avaliação pendente'", () => {
    const result = getPersonalAttentionItems({
      students: [{ id: "s1", displayName: "Lucas Pereira" }],
      overdueAmountCentsByStudentId: new Map(),
      lastAssessmentAtByStudentId: new Map(),
      now: NOW,
    });

    expect(result).toEqual([{ studentId: "s1", title: "Lucas Pereira", description: "Avaliação pendente", icon: "◎", tone: "neutral" }]);
  });

  it("sinaliza avaliação vencida (60 dias ou mais) com a contagem real de dias", () => {
    const seventyDaysAgo = new Date(NOW.getTime() - 70 * 24 * 60 * 60 * 1000);
    const result = getPersonalAttentionItems({
      students: [{ id: "s1", displayName: "Lucas Pereira" }],
      overdueAmountCentsByStudentId: new Map(),
      lastAssessmentAtByStudentId: new Map([["s1", seventyDaysAgo]]),
      now: NOW,
    });

    expect(result).toEqual([{ studentId: "s1", title: "Lucas Pereira", description: "Avaliação há 70 dias", icon: "◎", tone: "neutral" }]);
  });

  it("nunca sinaliza aluno com avaliação recente (abaixo do limiar) e sem pendência financeira", () => {
    const tenDaysAgo = new Date(NOW.getTime() - 10 * 24 * 60 * 60 * 1000);
    const result = getPersonalAttentionItems({
      students: [{ id: "s1", displayName: "Camila Souza" }],
      overdueAmountCentsByStudentId: new Map(),
      lastAssessmentAtByStudentId: new Map([["s1", tenDaysAgo]]),
      now: NOW,
    });

    expect(result).toEqual([]);
  });

  it("prioriza mensalidade vencida sobre avaliação pendente do mesmo aluno (nunca dois itens para a mesma pessoa)", () => {
    const result = getPersonalAttentionItems({
      students: [{ id: "s1", displayName: "Diego Santos" }],
      overdueAmountCentsByStudentId: new Map([["s1", 100]]),
      lastAssessmentAtByStudentId: new Map(),
      now: NOW,
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.description).toContain("Mensalidade vencida");
  });

  it("limita a lista a 5 itens mesmo com mais alunos precisando de atenção", () => {
    const students = Array.from({ length: 8 }, (_, index) => ({ id: `s${index}`, displayName: `Aluno ${index}` }));
    const overdue = new Map(students.map((student) => [student.id, 5000]));

    const result = getPersonalAttentionItems({
      students,
      overdueAmountCentsByStudentId: overdue,
      lastAssessmentAtByStudentId: new Map(),
      now: NOW,
    });

    expect(result).toHaveLength(5);
  });
});
