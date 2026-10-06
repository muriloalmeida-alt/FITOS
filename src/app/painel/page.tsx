import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { appName } from "@/shared/config/env";
import { getServerSession } from "@/modules/identity/session";
import { getAuthContext } from "@/modules/tenancy/authContext";
import { prisma } from "@/shared/db/prisma";
import { getStudentHome } from "@/modules/students/studentHome";
import { getIndividualHome } from "@/modules/workouts/individualHome";
import { ensureCurrentMonthCharges, getFinancialSummary } from "@/modules/student-finance/charges";
import { listStudentRoster, weeklyCompletionRate } from "@/modules/students/roster";
import { getPersonalFeed } from "@/modules/students/personalFeed";
import { riskCount } from "@/modules/students/riskPanel";
import { getSubscriptionForTenant, type SaasSubscriptionWithPlan } from "@/modules/billing/subscriptions";
import { getIndividualOnboardingProfile } from "@/modules/individual-onboarding/onboarding";
import { getPersonalOnboardingProfile } from "@/modules/personal-onboarding/onboarding";
import { PersonalHome, type PersonalHomeBanner } from "./PersonalHome";
import { AlunoHome } from "./AlunoHome";
import { AlunoSemVinculo } from "./AlunoSemVinculo";
import { AlunoInativo } from "./AlunoInativo";
import { IndividualHome } from "./IndividualHome";

export const metadata: Metadata = {
  title: `Painel — ${appName}`,
};

/// Saudação real por hora do request (FIT-137, tela-06) — sempre calculada
/// no servidor (nunca no cliente, que hidrataria com o fuso do navegador e
/// poderia divergir do HTML já enviado).
function greetingForHour(hour: number): string {
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

/// Fuso do produto (usuários no Brasil). AjustesPainel (29/09/2026): data e
/// saudação do cabeçalho seguem o relógio de Brasília, nunca o fuso do
/// servidor (UTC em homologação), que trocaria "Bom dia" por "Boa tarde"
/// três horas antes.
const PRODUCT_TIME_ZONE = "America/Sao_Paulo";

function hourInProductTimeZone(date: Date): number {
  const hour = new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hourCycle: "h23", timeZone: PRODUCT_TIME_ZONE }).format(date);
  return Number.parseInt(hour, 10);
}

/// "Terça, 29 de setembro" — eyebrow de data do Início (AjustesPainel).
function dateLabelFor(date: Date): string {
  const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "long", timeZone: PRODUCT_TIME_ZONE }).format(date).replace(/-feira$/, "");
  const dayMonth = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", timeZone: PRODUCT_TIME_ZONE }).format(date);
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${dayMonth}`;
}

/// Faixa do Início (FIT-143): teste grátis, problema na assinatura ou o
/// plano com as vagas livres. Sempre leva a Assinatura.
function subscriptionBanner(subscription: SaasSubscriptionWithPlan | null, activeStudents: number, now: Date): PersonalHomeBanner {
  if (!subscription) return { tone: "warn", text: "Você ainda não tem um plano.", cta: "Escolher plano" };
  if (subscription.status === "CANCELADA") return { tone: "warn", text: "Sua assinatura foi cancelada.", cta: "Assinar de novo" };
  if (subscription.status === "INADIMPLENTE") return { tone: "warn", text: "Pagamento da assinatura pendente.", cta: "Resolver" };
  // EPIC-33: o teste começa sem cartão; o aviso pede o cartão perto do fim.
  const needsCard = subscription.plan.priceCents > 0 && !subscription.creditCardLast4;
  if (subscription.trialEndsAt && subscription.trialEndsAt > now) {
    const days = Math.max(1, Math.ceil((subscription.trialEndsAt.getTime() - now.getTime()) / 86_400_000));
    const left = days === 1 ? "último dia" : `${days} dias restantes`;
    if (needsCard && days <= 7) return { tone: "warn", text: `Teste grátis · ${left}`, cta: "Cadastrar cartão" };
    return { tone: "trial", text: `Teste grátis · ${left}`, cta: needsCard ? "Cadastrar cartão" : "Ver planos" };
  }
  if (needsCard) return { tone: "warn", text: "Seu teste grátis acabou.", cta: "Cadastrar cartão" };
  const limit = subscription.plan.studentLimit;
  return { tone: "ok", text: limit ? `${subscription.plan.name} · ${Math.max(0, limit - activeStudents)} vagas livres` : `${subscription.plan.name} · alunos sem limite`, cta: "Assinatura" };
}

/// Aviso do FitOS Livre (EPIC-33): só na última semana do teste sem
/// cartão ou depois que ele acaba sem cartão.
function livreTrialNotice(subscription: SaasSubscriptionWithPlan | null, now: Date): string | null {
  if (!subscription || subscription.status !== "ATIVA" || subscription.plan.priceCents <= 0 || subscription.creditCardLast4) return null;
  // Depois do fim do teste, a faixa de carência/bloqueio (EPIC-38) avisa em todas as telas.
  if (!subscription.trialEndsAt || subscription.trialEndsAt <= now) return null;
  const days = Math.ceil((subscription.trialEndsAt.getTime() - now.getTime()) / 86_400_000);
  return days <= 7 ? `${days <= 1 ? "Último dia" : `Faltam ${days} dias`} de teste grátis. Cadastre o cartão para continuar.` : null;
}

/// Única rota autenticada (FIT-012): o shell exibido (personal ou aluno) é
/// decidido inteiramente no servidor, a partir do papel derivado da sessão
/// (`getAuthContext`, FIT-011) — não existem rotas separadas por papel
/// (`/painel/personal`, `/painel/aluno`), então não há URL para adulterar
/// e "trocar de shell": o mesmo `/painel` sempre resolve para o shell do
/// papel real do usuário autenticado.
export default async function PainelPage() {
  const [session, ctx] = await Promise.all([getServerSession(), getAuthContext()]);

  if (!session || !ctx.authenticated) {
    redirect("/entrar");
  }

  if (ctx.role === "ADMIN") {
    redirect("/painel/admin");
  }

  if (ctx.role === "PERSONAL") {
    const personalProfile = await getPersonalOnboardingProfile(ctx.tenantId);
    if (!personalProfile) {
      redirect("/onboarding-personal");
    }
    const now = new Date();
    const currentMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    // O feed e a carteira atualizam cobranças vencidas antes de ler; a
    // contagem de atrasadas vem depois, já com o status certo.
    // Mensalidades recorrentes do mês se lançam sozinhas (EPIC-29).
    await ensureCurrentMonthCharges({ tenantId: ctx.tenantId, now });
    const [roster, feed, financialSummary, subscription, openCharges, risk] = await Promise.all([
      listStudentRoster({ tenantId: ctx.tenantId, filter: "ativos", limit: 1000, now }),
      getPersonalFeed({ tenantId: ctx.tenantId, now }),
      getFinancialSummary({ tenantId: ctx.tenantId, referenceMonth: currentMonth }),
      getSubscriptionForTenant(ctx.tenantId),
      prisma.studentCharge.findMany({
        where: { tenantId: ctx.tenantId, status: { in: ["PENDENTE", "ATRASADO"] }, student: { status: "ATIVO" } },
        orderBy: [{ status: "asc" }, { dueDate: "asc" }],
        take: 50,
        select: { id: true, amountCents: true, status: true, student: { select: { displayName: true } } },
      }),
      riskCount(ctx.tenantId).catch(() => ({ total: 0, alto: 0 })),
    ]);
    const overdueCount = await prisma.studentCharge.count({ where: { tenantId: ctx.tenantId, status: "ATRASADO" } });

    return (
      <PersonalHome
        name={session.user.name}
        greeting={greetingForHour(hourInProductTimeZone(now))}
        dateLabel={dateLabelFor(now)}
        banner={subscriptionBanner(subscription, roster.counts.ativos, now)}
        stats={{
          activeStudents: roster.counts.ativos,
          studentLimit: subscription?.plan.studentLimit ?? null,
          weekCompletion: weeklyCompletionRate(roster.rows),
          receivedCents: financialSummary.recebidoCents,
          overdueCount,
        }}
        feed={feed}
        isNewSpace={roster.counts.todos === 0}
        openCharges={openCharges.map((charge) => ({ id: charge.id, studentName: charge.student.displayName, amountCents: charge.amountCents, overdue: charge.status === "ATRASADO" }))}
        students={roster.rows.map((row) => ({ id: row.id, name: row.displayName }))}
        risk={risk}
      />
    );
  }

  if (ctx.role === "INDIVIDUAL") {
    const profile = await getIndividualOnboardingProfile(ctx.tenantId);
    if (!profile) {
      redirect("/onboarding");
    }
    const now = new Date();
    const [home, subscription] = await Promise.all([getIndividualHome({ tenantId: ctx.tenantId, userId: ctx.userId, now }), getSubscriptionForTenant(ctx.tenantId)]);
    return <IndividualHome name={session.user.name} greeting={greetingForHour(hourInProductTimeZone(now))} dateLabel={dateLabelFor(now)} home={home} todayIso={now.toISOString()} trialNotice={livreTrialNotice(subscription, now)} />;
  }

  if (!ctx.studentId) {
    // FIT-016: "sem vínculo" (Student nunca existiu) e "inativo" (Student
    // existe, mas foi pausado pelo personal — FIT-014) são estados reais
    // distintos — cada um com sua própria mensagem, nunca confundidos.
    const student = await prisma.student.findUnique({ where: { userId: ctx.userId }, include: { tenant: { include: { owner: true } } } });
    return student?.status === "INATIVO" ? (
      <AlunoInativo name={session.user.name} personalName={student.tenant.owner.name} />
    ) : (
      <AlunoSemVinculo name={session.user.name} ended={student?.status === "VINCULO_ENCERRADO"} />
    );
  }

  const now = new Date();
  const [student, home, openCharge] = await Promise.all([
    prisma.student.findUniqueOrThrow({ where: { id: ctx.studentId }, include: { tenant: { include: { owner: true } } } }),
    getStudentHome({ tenantId: ctx.tenantId, studentId: ctx.studentId, now }),
    // EPIC-38: mensalidade em aberto que o personal mandou pelo app.
    prisma.studentCharge.findFirst({ where: { tenantId: ctx.tenantId, studentId: ctx.studentId, status: { in: ["PENDENTE", "ATRASADO"] }, paymentUrl: { not: null } }, orderBy: { dueDate: "asc" } }),
  ]);
  return (
    <AlunoHome
      displayName={student.displayName}
      personalName={student.tenant.owner.name}
      greeting={greetingForHour(hourInProductTimeZone(now))}
      dateLabel={dateLabelFor(now)}
      home={home}
      todayIso={now.toISOString()}
      payment={openCharge?.paymentUrl ? { description: openCharge.description, amountCents: openCharge.amountCents, dueIso: openCharge.dueDate.toISOString(), overdue: openCharge.dueDate < now, url: openCharge.paymentUrl } : null}
    />
  );
}
