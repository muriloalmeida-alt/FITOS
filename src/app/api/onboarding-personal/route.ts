import type { PersonalStudentRangeEstimate } from "@prisma/client";
import { authErrorResponse, requirePersonal } from "@/modules/tenancy/authContext";
import { completePersonalOnboarding, getPersonalOnboardingProfile, OnboardingError } from "@/modules/personal-onboarding/onboarding";
import { listStudents } from "@/modules/students/students";
import { SubscriptionError, subscribeTenantToPlan } from "@/modules/billing/subscriptions";
import { REFERRAL_COOKIE, applyPersonalReferral, referralCodeFromCookie } from "@/modules/billing/referrals";
import { listActivePlansForAudience } from "@/modules/billing/plans";
import { suggestPlan } from "@/modules/billing/suggestPlan";
import { prisma } from "@/shared/db/prisma";

const VALID_STUDENT_RANGES: PersonalStudentRangeEstimate[] = ["COMECANDO_AGORA", "ATE_20", "DE_21_A_50", "MAIS_DE_50"];

/// Estado atual do onboarding profissional do Personal autenticado
/// (FIT-113). Mesmo padrão de `/api/onboarding` (FIT-101).
export async function GET() {
  try {
    const ctx = await requirePersonal();
    const profile = await getPersonalOnboardingProfile(ctx.tenantId);
    return Response.json({ completed: profile !== null });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

/// Conclui (ou reabre) o onboarding profissional do Personal autenticado.
/// `redirectTo` no corpo da resposta é o "primeiro passo útil" da seção 7
/// do pacote: cadastrar o primeiro aluno quando o tenant ainda não tem
/// nenhum, senão o painel — decidido no servidor a partir do catálogo real
/// de alunos, nunca um valor fixo.
///
/// **Seleção de plano (FIT-126)**: `planId` é obrigatório — o pacote trata
/// "seleção de plano" como uma etapa real do onboarding do Personal, não
/// uma decisão opcional adiada. `subscribeTenantToPlan` (mesma função de
/// `/api/tenancy/minha-assinatura`, FIT-122/127) é chamada depois do
/// perfil salvo com sucesso; se ela falhar (plano inválido/inativo,
/// downgrade acima do limite), o perfil já salvo não é desfeito —
/// `completePersonalOnboarding` é idempotente, então reenviar o formulário
/// com um plano válido só atualiza o mesmo registro, nunca cria um
/// duplicado.
/// Cadastro mínimo do personal (EPIC-33): faixa de alunos e, se vier, nome
/// do espaço. Celular, CPF/CNPJ e CREF são opcionais (ficam para o Perfil e
/// para o cartão, no fim do teste). Sem `planId`, assina o plano sugerido
/// pela faixa, com o teste grátis — sem cartão.
export async function POST(request: Request) {
  try {
    const ctx = await requirePersonal();
    const body = await request.json().catch(() => null);
    const optionalString = (value: unknown) => (typeof value === "string" && value.trim() !== "" ? value : undefined);

    if (!body || !VALID_STUDENT_RANGES.includes(body.studentRangeEstimate) || (body.termsAccepted !== undefined && typeof body.termsAccepted !== "boolean")) {
      return Response.json({ error: "VALIDACAO", message: "Escolha quantos alunos você atende." }, { status: 400 });
    }

    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId }, select: { name: true } });
    await completePersonalOnboarding({
      tenantId: ctx.tenantId,
      phone: optionalString(body.phone),
      cref: optionalString(body.cref),
      cpfCnpj: optionalString(body.cpfCnpj),
      studentRangeEstimate: body.studentRangeEstimate,
      businessName: optionalString(body.businessName) ?? tenant.name,
      // Os termos são aceitos ao criar a conta (FIT-164).
      termsAccepted: body.termsAccepted ?? true,
    });

    const planId = optionalString(body.planId) ?? suggestPlan(await listActivePlansForAudience("PERSONAL"), body.studentRangeEstimate)?.id;
    if (!planId) {
      return Response.json({ error: "NAO_ENCONTRADO", message: "Nenhum plano disponível no momento." }, { status: 404 });
    }
    const existing = await prisma.saasSubscription.findUnique({ where: { tenantId: ctx.tenantId }, select: { planId: true } });
    if (!existing || existing.planId !== planId) {
      await subscribeTenantToPlan({ tenantId: ctx.tenantId, tenantType: "PERSONAL", planId, actorUserId: ctx.userId });
    }

    // EPIC-47: veio por indicação de outro personal → 30 dias a mais de teste.
    const referralCode = referralCodeFromCookie(request.headers.get("cookie"));
    if (referralCode) await applyPersonalReferral({ referredTenantId: ctx.tenantId, code: referralCode }).catch(() => false);

    const students = await listStudents({ tenantId: ctx.tenantId, pageSize: 1 });
    const redirectTo = students.total === 0 ? "/painel/primeiros-passos" : "/painel";
    const response = Response.json({ redirectTo }, { status: 201 });
    if (referralCode) response.headers.append("Set-Cookie", `${REFERRAL_COOKIE}=; Path=/; Max-Age=0`);
    return response;
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    if (error instanceof OnboardingError) {
      return Response.json({ error: error.kind, message: error.message }, { status: 400 });
    }
    if (error instanceof SubscriptionError) {
      const status = error.kind === "NAO_ENCONTRADO" ? 404 : error.kind === "VALIDACAO" ? 400 : 409;
      return Response.json({ error: error.kind, message: error.message }, { status });
    }
    throw error;
  }
}
