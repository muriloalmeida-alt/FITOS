import "server-only";
import { getMonthlyReport, parseMonth, shiftMonth } from "@/modules/execution/monthlyReport";
import type { MonthlyReportData } from "./MonthlyReportView";

/// Dados do relatório e os links de mês anterior/próximo (sem passar do
/// mês atual nem voltar antes do primeiro treino).
export async function reportProps(input: { tenantId: string; studentId: string; month?: string; base: string }) {
  const current = parseMonth(null);
  const month = parseMonth(input.month) > current ? current : parseMonth(input.month);
  const report = await getMonthlyReport({ tenantId: input.tenantId, studentId: input.studentId, month });
  const href = (value: string) => `${input.base}${input.base.includes("?") ? "&" : "?"}mes=${value}`;
  const prev = shiftMonth(month, -1);
  const data: MonthlyReportData = { ...report, photos: report.photos.map((photo) => ({ id: photo.id, pose: photo.pose, takenIso: photo.takenAt.toISOString() })) };
  return {
    report: data,
    prevHref: report.firstMonth && prev >= report.firstMonth ? href(prev) : null,
    nextHref: month < current ? href(shiftMonth(month, 1)) : null,
  };
}
