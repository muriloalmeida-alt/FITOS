import Link from "next/link";
import { AppShell, Card, WeeklyRhythmDots, WorkoutTodayCard } from "@/shared/ui";
import { LogoutButton } from "./LogoutButton";
import { INDIVIDUAL_NAV_ITEMS } from "./navigation";
import styles from "./IndividualHome.module.css";

interface SuggestedWorkout {
  id: string;
  name: string;
  exercisesCount: number;
}

interface IndividualHomeProps {
  name: string;
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
  /// Saudação/data do servidor no fuso do produto (AjustesTelas, print 28).
  greeting?: string;
  dateLabel?: string;
}

/// Hero de "Hoje" (tela-10, pacote visual 2026) — três estados reais, nunca
/// um placeholder: sessão em andamento (igual desde a FIT-134), treino
/// sugerido real existente (título/meta são o nome e a contagem reais do
/// próprio treino, nunca um texto motivacional genérico — removido na
/// FIT-142 a pedido de Murilo) ou nenhum treino ainda (CTA leva para criar
/// o primeiro, nunca finge que dá para "iniciar" algo que não existe).
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
        title={suggestedWorkout.name}
        description="Revise os exercícios abaixo e comece quando estiver pronto."
        meta={`${suggestedWorkout.exercisesCount} ${suggestedWorkout.exercisesCount === 1 ? "exercício" : "exercícios"}`}
        imageSrc="/media/brand/visual-2026/scene-solo.png"
        action={{ label: "Iniciar treino", href: `/painel/meus-treinos/${suggestedWorkout.id}` }}
      />
    );
  }
  return (
    <WorkoutTodayCard
      eyebrow="Seu movimento"
      title="Nenhum treino criado ainda"
      description="Crie seu primeiro treino para começar."
      imageSrc="/media/brand/visual-2026/scene-solo.png"
      action={{ label: "Criar meu primeiro treino", href: "/painel/meus-treinos/novo" }}
    />
  );
}

/// "Hoje para você" (tela-10): preview do treino sugerido, distinto do
/// hero acima — aqui é o conteúdo real e específico (nome, quantidade real
/// de exercícios, link direto).
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

/// "Hoje" do workspace individual (FIT-101/FIT-102/FIT-103). Criar treino
/// (FIT-102) e executar treino (FIT-103, registrar séries/carga/descanso
/// de verdade) já são reais.
/// FIT-142: a pedido de Murilo, removido o texto motivacional genérico do
/// hero ("Treine no seu próprio ritmo...") e os cards "Seu plano", "Seu
/// espaço" e "Meus treinos" — "Início" fica reduzido ao que é acionável no
/// dia a dia (hero real, "Hoje para você", "Sua evolução"). Sem perda de
/// função: workspace/objetivo/experiência/disponibilidade e a assinatura
/// já são reais em `/painel/perfil` (AjustesTelas 29/09/2026, real na
/// navegação do Livre desde a mesma rodada) — "Editar respostas" segue
/// disponível a partir de lá, não daqui.
export function IndividualHome({ name, inProgressWorkoutName, suggestedWorkout, weeklyRhythm, greeting, dateLabel }: IndividualHomeProps) {
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
    </AppShell>
  );
}
