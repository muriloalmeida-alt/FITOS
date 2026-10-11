/// Categorias do chat aluno ↔ personal (EPIC-39).
export const CHAT_CATEGORIES = [
  { key: "EXERCICIO", label: "Exercício", hint: "Execução, carga, troca de um exercício" },
  { key: "TREINO", label: "Treino", hint: "O programa, a semana, o volume" },
  { key: "DOR", label: "Dor ou desconforto", hint: "Algo incomodou no treino" },
  { key: "AGENDA", label: "Agenda", hint: "Horários, faltas, reposição" },
  { key: "PAGAMENTO", label: "Pagamento", hint: "Mensalidade e cobranças" },
  { key: "OUTRO", label: "Outro assunto", hint: "Qualquer outra coisa" },
] as const;

export type ChatCategory = (typeof CHAT_CATEGORIES)[number]["key"];

export function chatCategoryLabel(key: string): string {
  return CHAT_CATEGORIES.find((category) => category.key === key)?.label ?? "Mensagem";
}

export function isChatCategory(value: unknown): value is ChatCategory {
  return CHAT_CATEGORIES.some((category) => category.key === value);
}
