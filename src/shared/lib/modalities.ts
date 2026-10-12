/// Modalidades de treino (proposta 11, "Seu jeito de treinar"): ids
/// estáveis, nomes em português. A preferência é uma coleção (text[]),
/// nunca um texto separado por vírgulas. Vazio = ainda não definida.

export const MODALITIES = ["musculacao", "funcional", "crossfit"] as const;
export type Modality = (typeof MODALITIES)[number];

export const MODALITY_LABEL: Record<Modality, string> = { musculacao: "Musculação", funcional: "Funcional", crossfit: "CrossFit" };
export const MODALITY_HINT: Record<Modality, string> = {
  musculacao: "Força e exercícios com cargas",
  funcional: "Movimentos e circuitos",
  crossfit: "Treinos variados da modalidade",
};

export class ModalityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModalityError";
  }
}

export function isModality(value: unknown): value is Modality {
  return typeof value === "string" && (MODALITIES as readonly string[]).includes(value);
}

/// Validação do servidor: lista não vazia, só ids conhecidos, sem
/// duplicatas, na ordem canônica.
export function parseModalities(raw: unknown): Modality[] {
  if (!Array.isArray(raw)) throw new ModalityError("Escolha uma ou mais modalidades.");
  if (!raw.every(isModality)) throw new ModalityError("Modalidade desconhecida.");
  const chosen = MODALITIES.filter((modality) => raw.includes(modality));
  if (chosen.length === 0) throw new ModalityError("Escolha uma ou mais modalidades.");
  return chosen;
}

/// Leitura tolerante do banco: ignora o que não reconhece.
export function storedModalities(raw: readonly string[] | null | undefined): Modality[] {
  return MODALITIES.filter((modality) => (raw ?? []).includes(modality));
}

/// "Musculação + Funcional"; vazio = "Não definidas".
export function modalitiesLabel(list: readonly string[]): string {
  const known = storedModalities(list);
  return known.length > 0 ? known.map((modality) => MODALITY_LABEL[modality]).join(" + ") : "Não definidas";
}

/// Oferta automática: conteúdo classificado e com TODAS as modalidades
/// declaradas entre as escolhidas. Sem classificação, nunca entra.
export function offerable(content: readonly string[], chosen: readonly string[]): boolean {
  const declared = storedModalities(content);
  return declared.length > 0 && declared.length === content.length && declared.every((modality) => chosen.includes(modality));
}

/// Modalidades do programa ativo fora das preferências do aluno (para o
/// personal revisar). Sem preferência ou programa sem classificação: nada.
export function modalityDivergence(program: readonly string[], preferred: readonly string[]): Modality[] {
  const prefs = storedModalities(preferred);
  if (prefs.length === 0) return [];
  return storedModalities(program).filter((modality) => !prefs.includes(modality));
}
