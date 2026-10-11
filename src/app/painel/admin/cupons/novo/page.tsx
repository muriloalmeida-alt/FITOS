import type { Metadata } from "next";
import { AppShell } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { prisma } from "@/shared/db/prisma";
import { LogoutButton } from "../../../LogoutButton";
import { adminNavItems } from "../../../navigation";
import { couponAdminPage } from "../adminPage";
import { CouponEditor } from "../CouponEditor";

export const metadata: Metadata = { title: `Novo cupom — ${appName}` };

export default async function NovoCupomPage() {
  await couponAdminPage();
  const plans = await prisma.plan.findMany({ orderBy: [{ audience: "asc" }, { position: "asc" }], select: { id: true, name: true, audience: true, billingCycle: true, priceCents: true, active: true } });
  return (
    <AppShell eyebrow="Administração · Cupons" title="Novo cupom" navItems={adminNavItems(true)} activeKey="cupons" trailing={<LogoutButton />}>
      <CouponEditor plans={plans} />
    </AppShell>
  );
}
