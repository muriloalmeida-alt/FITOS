import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { AuthError, requirePersonal } from "@/modules/tenancy/authContext";
import { getStudentForTenant } from "@/modules/students/students";
import { listAssessmentsForStudent } from "@/modules/evolution/assessments";
import { LogoutButton } from "../../../LogoutButton";
import { PERSONAL_NAV_ITEMS } from "../../../navigation";
import { AssessmentRuler } from "./AssessmentRuler";
import { listEvolutionPhotos } from "@/modules/media/photos";
import { EvolutionPhotos } from "../../../_photos/EvolutionPhotos";

export const metadata: Metadata = { title: `Avaliação — ${appName}` };

const dateFmt = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", timeZone: "America/Sao_Paulo" });

/// Avaliação em segundos (EPIC-29): régua de peso já no último valor e o
/// resto opcional, e as fotos da avaliação (EPIC-35). Aluno de outro
/// tenant é 404.
export default async function AvaliacaoPage({ params }: { params: Promise<{ id: string }> }) {
  let ctx;
  try {
    ctx = await requirePersonal();
  } catch (error) {
    if (error instanceof AuthError) redirect(error.kind === "UNAUTHENTICATED" ? "/entrar" : "/painel");
    throw error;
  }
  const { id } = await params;
  const student = await getStudentForTenant({ tenantId: ctx.tenantId, studentId: id });
  if (!student) notFound();
  const [[last], photos] = await Promise.all([
    listAssessmentsForStudent({ tenantId: ctx.tenantId, studentId: student.id }),
    listEvolutionPhotos({ tenantId: ctx.tenantId, studentId: student.id }),
  ]);
  const firstName = student.displayName.trim().split(/\s+/)[0] ?? student.displayName;
  const measure = (type: string) => {
    const found = last?.measurements.find((m) => m.type === type);
    return found ? found.valueMillimeters / 10 : null;
  };

  return (
    <AppShell eyebrow={student.displayName} title="Avaliação de hoje" navItems={PERSONAL_NAV_ITEMS} activeKey="alunos" trailing={<LogoutButton />}>
      <AssessmentRuler
        studentId={student.id}
        firstName={firstName}
        last={
          last
            ? {
                dateLabel: dateFmt.format(last.recordedAt),
                weightKg: last.weightGrams !== null ? last.weightGrams / 1000 : null,
                bodyFatPercent: last.bodyFatTenthPercent !== null ? last.bodyFatTenthPercent / 10 : null,
                waistCm: measure("CINTURA"),
                hipCm: measure("QUADRIL"),
              }
            : null
        }
      />
      <EvolutionPhotos
        photos={photos.map((photo) => ({ id: photo.id, pose: photo.pose, takenIso: photo.takenAt.toISOString() }))}
        consent={Boolean(student.photoConsentAt)}
        owner={{ kind: "personal", studentId: student.id, firstName }}
      />
    </AppShell>
  );
}
