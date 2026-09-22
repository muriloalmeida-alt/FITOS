import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AppShell, Card } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { AuthError, requirePersonal } from "@/modules/tenancy/authContext";
import { getStudentForTenant } from "@/modules/students/students";
import { LogoutButton } from "../../../LogoutButton";
import { PERSONAL_NAV_ITEMS } from "../../../navigation";
import { EncerrarVinculoForm } from "./EncerrarVinculoForm";

export const metadata: Metadata = {
  title: `Encerrar vínculo — ${appName}`,
};

interface EncerrarVinculoPageProps {
  params: Promise<{ id: string }>;
}

/// Confirmação explícita antes de encerrar (mesmo padrão M3 de
/// `/inativar`: "texto explica impacto e reversibilidade"). Ao contrário
/// da inativação, aqui o texto precisa deixar claro que **não** é
/// reversível — é a diferença central que justifica `VINCULO_ENCERRADO`
/// como um terceiro estado, não um sinônimo de `INATIVO` (FIT-106,
/// `ADR-009-ENCERRAMENTO-DE-VINCULO.md`). Já encerrado -> nunca chega
/// aqui de novo pela UI (o botão na ficha do aluno some), mas a rota
/// continua idempotente se acessada diretamente.
export default async function EncerrarVinculoPage({ params }: EncerrarVinculoPageProps) {
  let ctx;
  try {
    ctx = await requirePersonal();
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(error.kind === "UNAUTHENTICATED" ? "/entrar" : "/painel");
    }
    throw error;
  }

  const { id } = await params;
  const student = await getStudentForTenant({ tenantId: ctx.tenantId, studentId: id });
  if (!student) {
    notFound();
  }

  if (student.status === "VINCULO_ENCERRADO") {
    redirect(`/painel/alunos/${student.id}`);
  }

  return (
    <AppShell title="Encerrar vínculo" navItems={PERSONAL_NAV_ITEMS} activeKey="alunos" trailing={<LogoutButton />}>
      <Card title={`Encerrar vínculo com ${student.displayName}?`}>
        <p>
          Esta ação é definitiva — ao contrário de inativar, um vínculo encerrado nunca pode ser reaberto. {student.displayName}{" "}
          perde acesso a planos personalizados, treinos futuros atribuídos e às suas notas privadas, mas o histórico
          (avaliações, sessões, cobranças) é sempre preservado, nunca excluído.
        </p>
        <EncerrarVinculoForm studentId={student.id} />
      </Card>
    </AppShell>
  );
}
