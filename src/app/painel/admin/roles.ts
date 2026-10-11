import type { UserRole } from "@prisma/client";
import type { TagTone } from "@/shared/ui";

export const ROLE_LABELS: Record<UserRole, string> = { PERSONAL: "Personal", ALUNO: "Aluno", INDIVIDUAL: "FitOS Livre", ADMIN: "Administrador" };
export const ROLE_TONES: Record<UserRole, TagTone> = { PERSONAL: "accent", ALUNO: "ok", INDIVIDUAL: "warn", ADMIN: "muted" };
export const ROLE_FILTERS: { key: string; role: UserRole | null; label: string }[] = [
  { key: "todos", role: null, label: "Todos" },
  { key: "personal", role: "PERSONAL", label: "Personal" },
  { key: "aluno", role: "ALUNO", label: "Alunos" },
  { key: "livre", role: "INDIVIDUAL", label: "FitOS Livre" },
  { key: "admin", role: "ADMIN", label: "Administradores" },
];
