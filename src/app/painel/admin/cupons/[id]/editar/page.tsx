import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { prisma } from "@/shared/db/prisma";
import { AdminError } from "@/modules/admin/users";
import { getCoupon } from "@/modules/billing/coupons";
import { LogoutButton } from "../../../../LogoutButton";
import { adminNavItems } from "../../../../navigation";
import { couponAdminPage } from "../../adminPage";
import { CouponEditor } from "../../CouponEditor";

export const metadata: Metadata = { title: `Editar cupom — ${appName}` };

export default async function EditarCupomPage({ params }: { params: Promise<{ id: string }> }) {
  await couponAdminPage();
  const { id } = await params;
  const coupon = await getCoupon(id).catch((error) => {
    if (error instanceof AdminError) notFound();
    throw error;
  });
  if (coupon.status === "ENDED" || coupon.status === "ARCHIVED") redirect(`/painel/admin/cupons/${id}`);
  const plans = await prisma.plan.findMany({ orderBy: [{ audience: "asc" }, { position: "asc" }], select: { id: true, name: true, audience: true, billingCycle: true, priceCents: true, active: true } });
  return (
    <AppShell eyebrow="Administração · Cupons" title={`Editar ${coupon.code}`} navItems={adminNavItems(true)} activeKey="cupons" trailing={<LogoutButton />}>
      <CouponEditor
        plans={plans}
        initial={{
          ...coupon,
          products: coupon.products,
          cycles: coupon.cycles,
          startsAt: coupon.startsAt?.toISOString() ?? null,
          endsAt: coupon.endsAt?.toISOString() ?? null,
        }}
      />
    </AppShell>
  );
}
