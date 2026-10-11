import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell, Button, Tag } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { prisma } from "@/shared/db/prisma";
import { couponSummary, formatCents } from "@/shared/lib/coupons";
import { AdminError } from "@/modules/admin/users";
import { getCoupon } from "@/modules/billing/coupons";
import { LogoutButton } from "../../../LogoutButton";
import { adminNavItems } from "../../../navigation";
import { couponAdminPage } from "../adminPage";
import { CYCLE_LABEL, PRODUCT_LABEL, SEGMENT_LABEL, STATUS_LABEL, STATUS_TONE, windowLabel } from "../couponLabels";
import { CouponActions } from "./CouponActions";
import adminStyles from "../../admin.module.css";
import styles from "../coupons.module.css";

export const metadata: Metadata = { title: `Cupom — ${appName}` };

const OPERATION_LABEL: Record<string, string> = { CRIADO: "Criado", EDITADO: "Editado", NOVA_VERSAO: "Nova versão", ATIVADO: "Ativado", PAUSADO: "Pausado", RETOMADO: "Retomado", ENCERRADO: "Encerrado", ARQUIVADO: "Arquivado" };
const dateTimeFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

/// Uma campanha: condições da versão vigente, público, ações e trilha.
export default async function CupomPage({ params }: { params: Promise<{ id: string }> }) {
  await couponAdminPage();
  const { id } = await params;
  const coupon = await getCoupon(id).catch((error) => {
    if (error instanceof AdminError) notFound();
    throw error;
  });
  const plans = await prisma.plan.findMany({ where: { id: { in: coupon.planIds } }, select: { name: true, priceCents: true } });
  const editable = coupon.status !== "ENDED" && coupon.status !== "ARCHIVED";
  return (
    <AppShell eyebrow="Administração · Cupons" title={coupon.name} subtitle={`Versão ${coupon.version}`} navItems={adminNavItems(true)} activeKey="cupons" trailing={<LogoutButton />}>
      <Link href="/painel/admin/cupons" className={adminStyles.back}>
        ‹ Cupons
      </Link>
      <div className={styles.head}>
        <h2 className={styles.code}>{coupon.code}</h2>
        <Tag tone={STATUS_TONE[coupon.status]}>{STATUS_LABEL[coupon.status]}</Tag>
      </div>
      <p>{couponSummary(coupon)}</p>
      <dl className={adminStyles.facts}>
        <div>
          <dt>Público</dt>
          <dd>
            {coupon.products.map((product) => PRODUCT_LABEL[product]).join(" e ")} · {coupon.segments.map((segment) => SEGMENT_LABEL[segment]).join(", ")}
          </dd>
        </div>
        <div>
          <dt>Planos</dt>
          <dd>{plans.map((plan) => `${plan.name} (${formatCents(plan.priceCents)})`).join(", ")}</dd>
        </div>
        <div>
          <dt>Ciclo</dt>
          <dd>{coupon.cycles.map((cycle) => CYCLE_LABEL[cycle]).join(" e ")}</dd>
        </div>
        <div>
          <dt>Resgate</dt>
          <dd>{windowLabel(coupon.startsAt, coupon.endsAt)}</dd>
        </div>
        <div>
          <dt>Limites</dt>
          <dd>
            {coupon.maxRedemptions ? `${coupon.maxRedemptions} contas` : "Sem limite de contas"} · {coupon.perAccountLimit} por conta
          </dd>
        </div>
        <div>
          <dt>Orçamento</dt>
          <dd>{coupon.budgetCents ? formatCents(coupon.budgetCents) : "Sem teto"}</dd>
        </div>
        <div>
          <dt>Acumulação</dt>
          <dd>{coupon.stackable ? "Com 1 outro cupom acumulável" : "Não acumula"}</dd>
        </div>
        {coupon.note ? (
          <div>
            <dt>Observação</dt>
            <dd>{coupon.note}</dd>
          </div>
        ) : null}
      </dl>
      {coupon.selected.length ? (
        <>
          <h3>Contas selecionadas</h3>
          <ul className={styles.audit}>
            {coupon.selected.map((account) => (
              <li key={account.tenantId}>
                {account.name} · {account.ownerEmail}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <div className={styles.actions}>
        {editable ? (
          <Button href={`/painel/admin/cupons/${coupon.id}/editar`} variant="secondary" block>
            {coupon.status === "DRAFT" ? "Editar" : "Editar (nova versão)"}
          </Button>
        ) : null}
        <CouponActions id={coupon.id} status={coupon.status} />
      </div>
      <h3>Histórico</h3>
      <ul className={styles.audit} aria-label="Histórico da campanha">
        {coupon.audit.map((row, index) => (
          <li key={index}>
            {OPERATION_LABEL[row.operation] ?? row.operation} · {dateTimeFmt.format(row.occurredAt)}
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
