import type { Metadata } from "next";
import { AppShell } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { prisma } from "@/shared/db/prisma";
import { LogoutButton } from "../LogoutButton";
import { selfPage } from "../_self";
import { WeighIn } from "./WeighIn";

export const metadata: Metadata = { title: `Pesar — ${appName}` };

const dateFmt = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", timeZone: "America/Sao_Paulo" });

/// Pesar hoje (EPIC-30): a régua começa no último peso.
export default async function PesarPage() {
  const ctx = await selfPage();
  const last = await prisma.assessment.findFirst({
    where: { tenantId: ctx.tenantId, studentId: ctx.studentId, deletedAt: null, weightGrams: { not: null } },
    orderBy: { recordedAt: "desc" },
    select: { weightGrams: true, bodyFatTenthPercent: true, recordedAt: true },
  });
  return (
    <AppShell eyebrow="Hoje" title="Quanto você pesa?" navItems={ctx.navItems} activeKey="progresso" trailing={<LogoutButton />}>
      <WeighIn
        last={last ? { weightKg: last.weightGrams! / 1000, bodyFatPercent: last.bodyFatTenthPercent !== null ? last.bodyFatTenthPercent / 10 : null, dateLabel: dateFmt.format(last.recordedAt) } : null}
        allowFat={ctx.livre}
        doneHref={ctx.progressHref}
      />
    </AppShell>
  );
}
