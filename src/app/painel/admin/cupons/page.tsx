import type { Metadata } from "next";
import { ActionRow, AppShell, Button, Tag } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { couponSummary } from "@/shared/lib/coupons";
import { listCoupons } from "@/modules/billing/coupons";
import { LogoutButton } from "../../LogoutButton";
import { adminNavItems } from "../../navigation";
import { couponAdminPage } from "./adminPage";
import { CYCLE_LABEL, PRODUCT_LABEL, SEGMENT_LABEL, STATUS_LABEL, STATUS_TONE, windowLabel } from "./couponLabels";
import styles from "../admin.module.css";

export const metadata: Metadata = { title: `Cupons — ${appName}` };

/// Administração → Cupons (feature 5): campanhas com código, desconto,
/// público, ciclos, prazo de resgate e estado.
export default async function CuponsPage() {
  await couponAdminPage();
  const coupons = await listCoupons();
  return (
    <AppShell eyebrow="Administração" title="Cupons" subtitle={`${coupons.length} ${coupons.length === 1 ? "campanha" : "campanhas"}`} navItems={adminNavItems(true)} activeKey="cupons" trailing={<LogoutButton />}>
      <Button href="/painel/admin/cupons/novo">Novo cupom</Button>
      {coupons.length === 0 ? (
        <p className={styles.empty}>Nenhuma campanha ainda.</p>
      ) : (
        <ul className={styles.list} aria-label="Campanhas de cupom">
          {coupons.map((coupon) => (
            <li key={coupon.id}>
              <ActionRow
                href={`/painel/admin/cupons/${coupon.id}`}
                title={
                  <>
                    {coupon.code} <Tag tone={STATUS_TONE[coupon.status]}>{STATUS_LABEL[coupon.status]}</Tag>
                  </>
                }
                description={[
                  coupon.name,
                  couponSummary(coupon).split(".")[0],
                  `${coupon.products.map((product) => PRODUCT_LABEL[product]).join(" e ")} · ${coupon.segments.map((segment) => SEGMENT_LABEL[segment]).join(", ")}`,
                  coupon.cycles.map((cycle) => CYCLE_LABEL[cycle]).join(" e "),
                  `resgate ${windowLabel(coupon.startsAt, coupon.endsAt)}`,
                ].join(" · ")}
                trailing={<span aria-hidden="true">›</span>}
              />
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
