import type { TagTone } from "@/shared/ui";

/// Textos dos cupons na administração (feature 5).
export const STATUS_LABEL: Record<string, string> = { DRAFT: "Rascunho", ACTIVE: "Ativo", PAUSED: "Pausado", ENDED: "Encerrado", ARCHIVED: "Arquivado" };
export const STATUS_TONE: Record<string, TagTone> = { DRAFT: "muted", ACTIVE: "ok", PAUSED: "warn", ENDED: "muted", ARCHIVED: "muted" };
export const SEGMENT_LABEL: Record<string, string> = { NOVOS: "Novos", ATIVOS: "Ativos", INATIVOS: "Inativos", SELECIONADOS: "Selecionados" };
export const SEGMENT_HELP: Record<string, string> = {
  NOVOS: "Nunca pagaram o FitOS (teste conta como novo)",
  ATIVOS: "Assinatura ativa com pagamento",
  INATIVOS: "Cancelaram e não têm período pago vigente",
  SELECIONADOS: "Só as contas que você escolher",
};
export const PRODUCT_LABEL: Record<string, string> = { PERSONAL: "Personal", INDIVIDUAL: "Livre" };
export const CYCLE_LABEL: Record<string, string> = { MENSAL: "Mensal", ANUAL: "Anual" };

const SAO_PAULO_OFFSET_MS = -3 * 3_600_000;
const DAY_MS = 86_400_000;

/// "AAAA-MM-DD" (dia em Brasília) → início do dia, em ISO.
export function startOfDayIso(day: string): string | null {
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? new Date(`${day}T00:00:00-03:00`).toISOString() : null;
}

/// Último dia incluído → fim exclusivo (início do dia seguinte), em ISO.
export function endAfterDayIso(day: string): string | null {
  const start = startOfDayIso(day);
  return start ? new Date(new Date(start).getTime() + DAY_MS).toISOString() : null;
}

/// Instante → "AAAA-MM-DD" em Brasília; com `lastIncluded`, o dia anterior
/// ao fim exclusivo.
export function dayOf(iso: string | Date | null, lastIncluded = false): string {
  if (!iso) return "";
  const time = new Date(iso).getTime() - (lastIncluded ? 1 : 0);
  return new Date(time + SAO_PAULO_OFFSET_MS).toISOString().slice(0, 10);
}

const dateFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Sao_Paulo" });

/// "01 de out. de 2026 a 31 de out. de 2026", "a partir de …", "sem prazo".
export function windowLabel(startsAt: string | Date | null, endsAt: string | Date | null): string {
  const start = startsAt ? dateFmt.format(new Date(startsAt)) : null;
  const end = endsAt ? dateFmt.format(new Date(new Date(endsAt).getTime() - 1)) : null;
  if (start && end) return `${start} a ${end}`;
  if (start) return `a partir de ${start}`;
  if (end) return `até ${end}`;
  return "sem prazo";
}
