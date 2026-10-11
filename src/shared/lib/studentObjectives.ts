/// Objetivos que o aluno escolhe ao entrar pelo convite (EPIC-33).
export const STUDENT_OBJECTIVES = ["Emagrecer", "Ganhar massa", "Saúde e disposição", "Ficar mais forte", "Condicionamento"] as const;
export type StudentObjective = (typeof STUDENT_OBJECTIVES)[number];
