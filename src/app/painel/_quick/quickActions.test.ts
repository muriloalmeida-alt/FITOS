import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

const inProgress = vi.fn();
const schedule = vi.fn();
const individualHome = vi.fn();
const featureEnabled = vi.fn();
vi.mock("@/modules/execution/sessions", () => ({ getInProgressSessionForStudent: (...args: unknown[]) => inProgress(...args) }));
vi.mock("@/modules/workouts/workouts", () => ({ getTodayScheduleForStudent: (...args: unknown[]) => schedule(...args) }));
vi.mock("@/modules/workouts/individualHome", () => ({ getIndividualHome: (...args: unknown[]) => individualHome(...args) }));
vi.mock("@/shared/config/features", () => ({ featureEnabled: (...args: unknown[]) => featureEnabled(...args) }));

import { quickActionsFor } from "./quickActions";

const client = (status: string | null) => ({ student: { findUnique: vi.fn(async () => (status ? { id: "s1", tenantId: "t1", status } : null)) } }) as unknown as PrismaClient;
const labels = (actions: { label: string; href: string }[]) => actions.map((action) => `${action.label} → ${action.href}`);

describe("acesso rápido: ações por perfil", () => {
  afterEach(() => vi.resetAllMocks());

  it("personal: exatamente 3, na ordem aprovada", async () => {
    expect(labels(await quickActionsFor({ role: "PERSONAL" }))).toEqual(["Aplicar programa → /painel/treinos?aba=programas", "Montar treino → /painel/treinos/novo", "Convidar aluno → /painel/alunos/convite"]);
  });

  it("aluno com personal: continuar, treino do dia, dia livre e sem programa; sempre 2", async () => {
    inProgress.mockResolvedValueOnce({ id: "x" });
    expect(labels(await quickActionsFor({ role: "ALUNO", userId: "u" }, client("ATIVO")))).toEqual(["Continuar treino → /painel/treino/sessao", "Meus treinos → /painel/treino"]);
    inProgress.mockResolvedValue(null);
    schedule.mockResolvedValueOnce({ state: "TREINO_HOJE" });
    expect(labels(await quickActionsFor({ role: "ALUNO", userId: "u" }, client("ATIVO")))[0]).toBe("Começar treino → /painel?iniciar=1");
    schedule.mockResolvedValueOnce({ state: "DESCANSO" });
    expect(labels(await quickActionsFor({ role: "ALUNO", userId: "u" }, client("ATIVO")))[0]).toBe("Começar treino → /painel?iniciar=1");
    schedule.mockResolvedValueOnce({ state: "SEM_PLANO" });
    expect(labels(await quickActionsFor({ role: "ALUNO", userId: "u" }, client("ATIVO")))).toEqual(["Ver meu programa → /painel/treino", "Meus treinos → /painel/treino"]);
  });

  it("aluno sem vínculo ativo não recebe atalho de treino", async () => {
    expect(await quickActionsFor({ role: "ALUNO", userId: "u" }, client("INATIVO"))).toEqual([]);
    expect(await quickActionsFor({ role: "ALUNO", userId: "u" }, client(null))).toEqual([]);
  });

  it("Livre: começar o treino do dia ou escolher programa; registrar treino passado só com a flag", async () => {
    featureEnabled.mockReturnValue(true);
    individualHome.mockResolvedValueOnce({ inProgress: null, today: { id: "w1" } });
    expect(labels(await quickActionsFor({ role: "INDIVIDUAL", userId: "u", tenantId: "t" }))).toEqual(["Começar treino → /painel/meus-treinos/sessao?treino=w1", "Registrar treino passado → /painel/treinos-realizados/registrar"]);
    individualHome.mockResolvedValueOnce({ inProgress: { workoutName: "A" }, today: { id: "w1" } });
    expect(labels(await quickActionsFor({ role: "INDIVIDUAL", userId: "u", tenantId: "t" }))[0]).toBe("Continuar treino → /painel/meus-treinos/sessao");
    featureEnabled.mockReturnValue(false);
    individualHome.mockResolvedValueOnce({ inProgress: null, today: null });
    expect(labels(await quickActionsFor({ role: "INDIVIDUAL", userId: "u", tenantId: "t" }))).toEqual(["Escolher programa → /painel/meus-treinos/biblioteca", "Meus treinos → /painel/meus-treinos"]);
  });

  it("admin: nenhum", async () => {
    expect(await quickActionsFor({ role: "ADMIN" })).toEqual([]);
  });
});
