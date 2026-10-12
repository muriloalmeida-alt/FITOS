import type { CrmProspectStatus } from "@prisma/client";
import type { TagTone } from "@/shared/ui";

export const STATUS_LABEL: Record<CrmProspectStatus, string> = { NOVO: "Novo", CONVIDADO: "Convidado", ABERTO: "Abriu o link", CADASTRADO: "Cadastrou-se", DESCARTADO: "Descartado" };
export const STATUS_TONE: Record<CrmProspectStatus, TagTone> = { NOVO: "muted", CONVIDADO: "accent", ABERTO: "accent", CADASTRADO: "ok", DESCARTADO: "muted" };

export const STATUS_FILTERS: { key: string; label: string; status: CrmProspectStatus | null }[] = [
  { key: "todos", label: "Todos", status: null },
  { key: "novos", label: "Novos", status: "NOVO" },
  { key: "convidados", label: "Convidados", status: "CONVIDADO" },
  { key: "abriram", label: "Abriram", status: "ABERTO" },
  { key: "cadastrados", label: "Cadastrados", status: "CADASTRADO" },
  { key: "descartados", label: "Descartados", status: "DESCARTADO" },
];
