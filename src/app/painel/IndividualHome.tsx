import type { ExperienceLevel, IndividualObjective, WeeklyAvailability } from "@prisma/client";
import Link from "next/link";
import { AppShell, Button, Card, WeeklyRhythmDots, WorkoutTodayCard } from "@/shared/ui";
import { formatCentsBRL } from "@/shared/lib/money";
import { LogoutButton } from "./LogoutButton";
import { INDIVIDUAL_NAV_ITEMS } from "./navigation";
import { AVAILABILITY_LABELS, EXPERIENCE_LABELS, OBJECTIVE_LABELS } from "./individualProfileLabels";
import styles from "./IndividualHome.module.css";

interface SuggestedWorkout {
  id: string;
  name: string;
  exercisesCount: number;
}

interface IndividualSubscription {
  planName: string;
  priceCents: number;
  trialEndsAt: string | null;
}

interface IndividualHomeProps {
  name: string;
  tenantName: string;
  objective: IndividualObjective;
  experienceLevel: ExperienceLevel;
  weeklyAvailability: WeeklyAvailability;
  workoutsCount: number;
  inProgressWorkoutName: string | null;
  /// Sugestão real do "Hoje para você" (tela-10) — sempre o primeiro treino
  /// real do próprio praticante (`/painel/page.tsx`), nunca inventado.
  /// `null` quando ainda não existe nenhum treino.
  suggestedWorkout: SuggestedWorkout | null;
  /// Ritmo real da semana atual (FIT-137, `getWeeklyRhythmForStudent`) —
  /// sem `targetDays` aqui: o workspace individual não tem o conceito de
  /// plano atribuído, então "Sua evolução" mostra só a contagem real, sem
  /// fração/meta (diferente da barra do Aluno).
  weeklyRhythm: { completedDays: number; dayFlags: boolean[] };
  /// Assinatura real do tenant (FIT-122/127), `null` quando ainda não há
  /// nenhuma contratada — a seção "Seu plano" só aparece com dado real.
  subscription: IndividualSubscription | null;
  /// Saudação/data do servidor no fuso do produto (AjustesTelas, print 28).
  greeting?: string;
  dateLabel?: string;
}

/// Hero de "Hoje" (tela-10, pacote visual 2026) — três estados reais, nunca
/// um placeholder: sessão em andamento (igual desde a FIT-134), treino
/// sugerido real existente (primeiro da lista, CTA leva direto para o
/// treino, onde o botão real de começar já existe) ou nenhum treino ainda
/// (CTA leva para criar o primeiro, nunca finge que dá para "iniciar" algo
/// que não existe).
function HeroDoDia({ inProgressWorkoutName, suggestedWorkout }: { inProgressWorkoutName: string | null; suggestedWorkout: SuggestedWorkout | null }) {
  if (inProgressWorkoutName) {
    return (
      <WorkoutTodayCard
        eyebrow="Treino em andamento"
        title={inProgressWorkoutName}
        description="Continue de onde parou."
        imageSrc="/media/brand/visual-2026/scene-solo.png"
        action={{ label: "Continuar treino", href: "/painel/meus-treinos/sessao" }}
      />
    );
  }
  if (suggestedWorkout) {
    return (
      <WorkoutTodayCard
        eyebrow="Seu movimento"
        title="Treine no seu próprio ritmo."
        description="Comece quando estiver pronto — no seu tempo, do seu jeito."
        imageSrc="/media/brand/visual-2026/scene-solo.png"
        action={{ label: "Iniciar treino", href: `/painel/meus-treinos/${suggestedWorkout.id}` }}
      />
    );
  }
  return (
    <WorkoutTodayCard
      eyebrow="Seu movimento"
      title="Treine no seu próprio ritmo."
      description="Crie seu primeiro treino para começar."
      imageSrc="/media/brand/visual-2026/scene-solo.png"
      action={{ label: "Criar meu primeiro treino", href: "/painel/meus-treinos/novo" }}
    />
  );
}

/// "Hoje para você" (tela-10): preview do treino sugerido, distinto do
/// hero acima (que é sempre motivacional/genérico) — aqui é o conteúdo
/// real e específico (nome, quantidade real de exercícios, link direto).
function HojeParaVoce({ suggestedWorkout }: { suggestedWorkout: SuggestedWorkout }) {
  return (
    <Card title="Hoje para você">
      <div className={styles.suggestedWorkout}>
        <div className={styles.suggestedWorkoutText}>
          <strong className={styles.suggestedWorkoutName}>{suggestedWorkout.name}</strong>
          <span className={styles.suggestedWorkoutMeta}>
            {suggestedWorkout.exercisesCount} {suggestedWorkout.exercisesCount === 1 ? "exercício" : "exercícios"}
          </span>
        </div>
        <Link href={`/painel/meus-treinos/${suggestedWorkout.id}`} className={styles.suggestedWorkoutLink}>
          Ver treino ↗
        </Link>
      </div>
    </Card>
  );
}

function SuaEvolucao({ weeklyRhythm }: { weeklyRhythm: { completedDays: number; dayFlags: boolean[] } }) {
  return (
    <Card title="Sua evolução">
      <div className={styles.evolution}>
        <p className={styles.evolutionCount}>
          <strong className={styles.evolutionNumber}>{weeklyRhythm.completedDays}</strong>{" "}
          {weeklyRhythm.completedDays === 1 ? "treino nesta semana" : "treinos nesta semana"}
        </p>
        <WeeklyRhythmDots dayFlags={weeklyRhythm.dayFlags} />
      </div>
    </Card>
  );
}

function SeuPlano({ subscription }: { subscription: IndividualSubscription }) {
  const trialActive = subscription.trialEndsAt !== null && new Date(subscription.trialEndsAt) > new Date();
  return (
    <Card title="Seu plano">
      <p className={styles.planName}>{subscription.planName}</p>
      <p className={styles.planDetail}>
        {trialActive
          ? `Período grátis até ${new Date(subscription.trialEndsAt!).toLocaleDateString("pt-BR")}, depois ${formatCentsBRL(subscription.priceCents)}/mês`
          : `${formatCentsBRL(subscription.priceCents)}/mês`}
      </p>
    </Card>
  );
}

/// "Hoje" do workspace individual (FIT-101/FIT-102/FIT-103). Criar treino
/// (FIT-102) e executar treino (FIT-103, registrar séries/carga/descanso
/// de verdade) já são reais.
/// FIT-137 (correção pós-validação real, pacote visual 2026 — tela-10):
/// o PR anterior (FIT-134) só tratava o estado "sessão em andamento" —
/// o estado padrão (sem sessão, o mais comum) não tinha hero, CTA,
/// evolução nem plano, nada do que a tela-10 mostra. Corrigido com dados
/// 100% reais: `suggestedWorkout` (primeiro treino real do praticante),
/// `weeklyRhythm` (`getWeeklyRhythmForStudent`) e `subscription`
/// (`getSubscriptionForTenant`) — nenhum "45 min" ou nome de treino do
/// print, cada seção só aparece quando há dado real para mostrar.
export function IndividualHome({
  name,
  tenantName,
  objective,
  experienceLevel,
  weeklyAvailability,
  workoutsCount,
  inProgressWorkoutName,
  suggestedWorkout,
  weeklyRhythm,
  subscription,
  greeting,
  dateLabel,
}: IndividualHomeProps) {
  const firstName = name.trim().split(/\s+/)[0] ?? name;
  return (
    <AppShell
      eyebrow={dateLabel}
      title={`${greeting ?? "Olá"}, ${firstName}.`}
      subtitle="Seu treino em movimento."
      navItems={INDIVIDUAL_NAV_ITEMS}
      activeKey="hoje"
      trailing={<LogoutButton />}
    >
      <HeroDoDia inProgressWorkoutName={inProgressWorkoutName} suggestedWorkout={suggestedWorkout} />

      {suggestedWorkout && !inProgressWorkoutName ? <HojeParaVoce suggestedWorkout={suggestedWorkout} /> : null}

      <SuaEvolucao weeklyRhythm={weeklyRhythm} />

      {subscription ? <SeuPlano subscription={subscription} /> : null}

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
