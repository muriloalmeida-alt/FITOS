import type { ExperienceLevel, IndividualObjective, WeeklyAvailability } from "@prisma/client";

/// Rótulos do perfil de treino do FitOS Livre (onboarding individual,
/// FIT-101) — compartilhados por "Início" (`IndividualHome`) e "Perfil"
/// (`/painel/perfil`, AjustesTelas 29/09/2026).
export const OBJECTIVE_LABELS: Record<IndividualObjective, string> = {
  GANHAR_MASSA: "Ganhar massa muscular",
  PERDER_PESO: "Perder peso",
  CONDICIONAMENTO_GERAL: "Condicionamento geral",
  SAUDE_E_BEM_ESTAR: "Saúde e bem-estar",
  OUTRO: "Outro",
};

export const EXPERIENCE_LABELS: Record<ExperienceLevel, string> = {
  INICIANTE: "Iniciante",
  INTERMEDIARIO: "Intermediário",
  AVANCADO: "Avançado",
};

export const AVAILABILITY_LABELS: Record<WeeklyAvailability, string> = {
  UM_A_DOIS_DIAS: "1 a 2 dias por semana",
  TRES_A_QUATRO_DIAS: "3 a 4 dias por semana",
  CINCO_OU_MAIS_DIAS: "5 dias ou mais por semana",
};
