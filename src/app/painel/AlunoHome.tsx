import { formatCentsBRL } from "@/shared/lib/money";
import { panelGoals, panelWeek } from "@/shared/lib/panel";
import type { StudentHome } from "@/modules/students/studentHome";
import { ALUNO_NAV_ITEMS } from "./navigation";
import { NoticeRow } from "./_panel/NoticeRow";
import { StudentPanel } from "./_panel/StudentPanel";

interface AlunoHomeProps {
  displayName: string;
  personalName: string;
  dateLabel?: string;
  home: StudentHome;
  /// Agora (ISO), no fuso do produto para a semana e o mês.
  todayIso: string;
  /// Treinos concluídos (data de realização, ISO) na semana e no mês.
  performed?: string[];
  /// "Meus dias" do aluno; vazios, contam os dias do programa.
  preferredDays?: string[];
  /// Registro de treino passado (FEATURE_RETROATIVO).
  retroEnabled?: boolean;
  /// O + abre direto a escolha de como treinar (proposta 9).
  startOpen?: boolean;
  /// Mensalidade em aberto com link de pagamento (EPIC-38).
  payment?: { description: string; amountCents: number; dueIso: string; overdue: boolean; url: string } | null;
  /// Ficha de saúde ainda não respondida (EPIC-46).
  healthPending?: boolean;
  /// Próxima aula na agenda (EPIC-48), já formatada.
  nextClass?: string | null;
}

const dateFmt = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", timeZone: "America/Sao_Paulo" });

/// Início do aluno com personal no painel aprovado (proposta 9): semana,
/// Iniciar treino (programado ou realizado) e evolução contra a meta; depois,
/// um aviso por vez, numa linha (pagamento, aula, ficha, peso, nessa
/// ordem), para o Início caber na tela sem rolagem.
export function AlunoHome({ displayName, personalName, dateLabel, home, todayIso, performed = [], preferredDays = [], retroEnabled = false, startOpen = false, payment = null, healthPending = false, nextClass = null }: AlunoHomeProps) {
  const firstName = displayName.trim().split(/\s+/)[0] ?? displayName;
  const now = new Date(todayIso);
  const dates = performed.map((iso) => new Date(iso));
  const { hero } = home;
  const week = panelWeek(now, dates, home.week.planned);
  const goals = panelGoals(now, dates, preferredDays.length > 0 ? preferredDays : home.week.planned, home.week.target);
  const todayLabel =
    hero.kind === "progress" ? `Hoje: ${hero.workoutName} em andamento` : hero.kind === "today" ? `Hoje: ${hero.workoutName}` : hero.kind === "rest" ? "Hoje: dia livre" : "Hoje: sem programa";
  const programmed =
    hero.kind === "today"
      ? { href: "/painel/treino/sessao", description: `Seguir o programa: ${hero.workoutName}` }
      : hero.kind === "rest"
        ? { href: "/painel/treino", description: "Dia livre: escolha um treino do programa" }
        : { href: "/painel/treino", description: hero.kind === "noPlan" ? `Sem programa ainda: ${personalName.split(/\s+/)[0]} já foi avisado` : "Seguir o programa" };
  const assessment = home.lastAssessment;
  const lastWeighDays = assessment ? Math.floor((now.getTime() - new Date(assessment.dateIso).getTime()) / 86_400_000) : null;
  const personalFirst = personalName.split(/\s+/)[0];
  const notice = payment ? (
    <NoticeRow
      eyebrow={payment.overdue ? "Mensalidade atrasada" : "Mensalidade"}
      text={`Pagar ${formatCentsBRL(payment.amountCents)} · ${payment.overdue ? "venceu" : "vence"} em ${dateFmt.format(new Date(payment.dueIso))}`}
      href={payment.url}
      tone={payment.overdue ? "warn" : "default"}
    />
  ) : nextClass ? (
    <NoticeRow eyebrow="Próxima aula" text={`${nextClass} · com ${personalFirst}`} href="/painel/agenda" />
  ) : healthPending ? (
    <NoticeRow eyebrow="2 minutos" text="Responda sua ficha de saúde" href="/painel/saude" />
  ) : lastWeighDays === null || lastWeighDays >= 14 ? (
    <NoticeRow eyebrow="Pesar hoje?" text={assessment ? `A última foi em ${dateFmt.format(new Date(assessment.dateIso))}` : "Registre seu primeiro peso"} href="/painel/pesar" />
  ) : null;

  return (
    <StudentPanel
      firstName={firstName}
      dateLabel={dateLabel}
      message={hero.kind === "progress" ? "Seu treino está em andamento." : "Seu próximo treino começa aqui."}
      week={{ ...week, todayLabel }}
      evolution={{ ...goals, href: "/painel/progresso" }}
      start={{ inProgressHref: hero.kind === "progress" ? "/painel/treino/sessao" : null, programmed, free: false, done: retroEnabled ? "/painel/treinos-realizados/registrar" : null }}
      startOpen={startOpen}
      navItems={ALUNO_NAV_ITEMS}
      notices={notice}
    />
  );
}
