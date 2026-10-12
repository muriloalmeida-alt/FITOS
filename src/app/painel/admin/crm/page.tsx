import type { Metadata } from "next";
import type { CrmProspectStatus } from "@prisma/client";
import { AppShell } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { listProspects } from "@/modules/crm/prospects";
import { formatMobile, inviteMessage, whatsappLink } from "@/shared/lib/crm";
import { FilterLinks } from "../../_workout-builder/FilterLinks";
import { RosterSearch } from "../../alunos/RosterSearch";
import { LogoutButton } from "../../LogoutButton";
import { adminNavItems } from "../../navigation";
import { couponAdminPage } from "../cupons/adminPage";
import { CrmView, type CrmRow } from "./CrmView";
import { STATUS_FILTERS } from "./crmLabels";

export const metadata: Metadata = { title: `CRM — ${appName}` };

const dateFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" });

/// Administração → CRM de convites: futuros clientes do FitOS Livre
/// convidados pelo WhatsApp com a mensagem padrão "Conheça o FitOS" e um
/// cupom próprio (50% no primeiro mês, além do teste grátis).
export default async function CrmPage({ searchParams }: { searchParams?: Promise<{ situacao?: string; q?: string }> } = {}) {
  await couponAdminPage();
  const sp = (await searchParams) ?? {};
  const filter = STATUS_FILTERS.find((entry) => entry.key === sp.situacao) ?? STATUS_FILTERS[0]!;
  const { rows, counts } = await listProspects({ status: filter.status, query: sp.q });
  const base = (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const href = (key: string) => {
    const params = new URLSearchParams();
    if (key !== "todos") params.set("situacao", key);
    if (sp.q) params.set("q", sp.q);
    return params.toString() ? `/painel/admin/crm?${params}` : "/painel/admin/crm";
  };

  const view: CrmRow[] = rows.map((row) => {
    const message = inviteMessage({ name: row.name, couponCode: row.couponCode, link: `${base}/conheca/${row.token}` });
    return {
      id: row.id,
      name: row.name,
      phoneLabel: formatMobile(row.phone),
      email: row.email,
      note: row.note,
      status: row.status,
      couponCode: row.couponCode,
      inviteCount: row.inviteCount,
      message,
      whatsappUrl: whatsappLink(row.phone, message),
      timeline: [
        `cadastrado em ${dateFmt.format(row.createdAt)}`,
        row.invitedAt ? `${row.inviteCount === 1 ? "convidado" : `convidado ${row.inviteCount}×`}, último em ${dateFmt.format(row.invitedAt)}` : null,
        row.openedAt ? `abriu em ${dateFmt.format(row.openedAt)}` : null,
        row.signedUpAt ? `cadastrou-se em ${dateFmt.format(row.signedUpAt)}` : null,
      ].filter((entry): entry is string => Boolean(entry)),
    };
  });

  return (
    <AppShell eyebrow="Administração" title="CRM" subtitle={`${total} ${total === 1 ? "contato" : "contatos"} · convites do FitOS Livre`} navItems={adminNavItems(true)} activeKey="crm" trailing={<LogoutButton />}>
      <RosterSearch />
      <FilterLinks label="Situação" items={STATUS_FILTERS.map((entry) => ({ label: `${entry.label} (${entry.status ? counts[entry.status as CrmProspectStatus] : total})`, href: href(entry.key), active: entry.key === filter.key }))} />
      <CrmView rows={view} queue={filter.status === null || filter.status === "NOVO" ? view.filter((row) => row.status === "NOVO") : []} />
    </AppShell>
  );
}
