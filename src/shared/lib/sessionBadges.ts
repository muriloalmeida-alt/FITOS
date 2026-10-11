import { formatPoints } from "./scoring";

/// Etiquetas de um treino no histórico (feature 2, parte 2): "Registrado"
/// para o retroativo e a situação dos pontos dos Desafios. Puro.

export type BadgeTone = "ok" | "muted" | "accent" | "warn";

export interface SessionBadge {
  label: string;
  tone: BadgeTone;
}

export function sessionBadges(session: { mode: string; points: { totalTenths: number; status: string } | null }): SessionBadge[] {
  const badges: SessionBadge[] = [];
  if (session.mode === "RETROATIVO") badges.push({ label: "Registrado", tone: "muted" });
  const points = session.points;
  if (points) {
    if (points.status === "PENDENTE_FOTO") badges.push({ label: "Salvo sem pontuação", tone: "warn" });
    else if (points.status === "ANULADO") badges.push({ label: "Pontos anulados", tone: "muted" });
    else if (points.status === "CONTESTADO") badges.push({ label: "Em contestação", tone: "warn" });
    else badges.push({ label: `${formatPoints(points.totalTenths)} pontos`, tone: "accent" });
  }
  return badges;
}
