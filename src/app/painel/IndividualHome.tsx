import type { ExperienceLevel, IndividualObjective, WeeklyAvailability } from "@prisma/client";
import { AppShell, Button, Card } from "@/shared/ui";
import { LogoutButton } from "./LogoutButton";
import { INDIVIDUAL_NAV_ITEMS } from "./navigation";

interface IndividualHomeProps {
  name: string;
  tenantName: string;
  objective: IndividualObjective;
  experienceLevel: ExperienceLevel;
  weeklyAvailability: WeeklyAvailability;
  workoutsCount: number;
  inProgressWorkoutName: string | null;
}

const OBJECTIVE_LABELS: Record<IndividualObjective, string> = {
  GANHAR_MASSA: "Ganhar massa muscular",
  PERDER_PESO: "Perder peso",
  CONDICIONAMENTO_GERAL: "Condicionamento geral",
  SAUDE_E_BEM_ESTAR: "Saúde e bem-estar",
  OUTRO: "Outro",
};

const EXPERIENCE_LABELS: Record<ExperienceLevel, string> = {
  INICIANTE: "Iniciante",
  INTERMEDIARIO: "Intermediário",
  AVANCADO: "Avançado",
};

const AVAILABILITY_LABELS: Record<WeeklyAvailability, string> = {
  UM_A_DOIS_DIAS: "1 a 2 dias por semana",
  TRES_A_QUATRO_DIAS: "3 a 4 dias por semana",
  CINCO_OU_MAIS_DIAS: "5 dias ou mais por semana",
};

/// "Hoje" do workspace individual (FIT-101/FIT-102/FIT-103). Criar treino
/// (FIT-102) e executar treino (FIT-103, registrar séries/carga/descanso
/// de verdade) já são reais.
export function IndividualHome({
  name,
  tenantName,
  objective,
  experienceLevel,
  weeklyAvailability,
  workoutsCount,
  inProgressWorkoutName,
}: IndividualHomeProps) {
  return (
    <AppShell title="Hoje" subtitle={`Olá, ${name}`} navItems={INDIVIDUAL_NAV_ITEMS} activeKey="hoje" trailing={<LogoutButton />}>
      <Card title="Seu espaço">
        <p>
          Workspace: <strong>{tenantName}</strong>
        </p>
        <p>
          Objetivo: <strong>{OBJECTIVE_LABELS[objective]}</strong>
        </p>
        <p>
          Experiência: <strong>{EXPERIENCE_LABELS[experienceLevel]}</strong>
        </p>
        <p>
          Disponibilidade: <strong>{AVAILABILITY_LABELS[weeklyAvailability]}</strong>
        </p>
        <Button href="/onboarding" variant="outlined">
          Editar respostas
        </Button>
      </Card>

      {inProgressWorkoutName ? (
        <Card title="Treino em andamento">
          <p>{inProgressWorkoutName}</p>
          <Button href="/painel/meus-treinos/sessao" variant="filled">
            Continuar treino
          </Button>
        </Card>
      ) : null}

      <Card title="Meus treinos">
        <p>
          {workoutsCount} {workoutsCount === 1 ? "treino criado" : "treinos criados"}
        </p>
        <Button href="/painel/meus-treinos" variant="filled">
          Ver meus treinos
        </Button>
      </Card>
    </AppShell>
  );
}
