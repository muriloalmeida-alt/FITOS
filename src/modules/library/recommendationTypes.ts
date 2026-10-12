import type { Modality } from "@/shared/lib/modalities";

/// Tipos das recomendações do onboarding (proposta 11), sem dependência
/// de servidor: a tela do Livre os usa direto.

export type ProgramChoice = { kind: "inicial" } | { kind: "programa"; key: string };

export interface RecommendationOption {
  choice: ProgramChoice;
  name: string;
  modalityLabel: string;
  /// Dados reais cadastrados: frequência, semanas, minutos, nível.
  facts: string[];
  notes: string[];
  workouts: { name: string; days: string; format: string | null; exercises: { name: string; dose: string }[] }[];
}

export interface Recommendations {
  groups: { modalities: Modality[]; label: string; options: RecommendationOption[] }[];
  /// Modalidades escolhidas sem nenhum programa disponível.
  missing: Modality[];
}
