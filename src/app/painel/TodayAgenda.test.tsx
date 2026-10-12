import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "@/shared/ui";
import { TodayAgenda, type TodayClass } from "./TodayAgenda";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh }) }));
const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

const aula = (over: Partial<TodayClass>): TodayClass => ({ ref: "slot:s1:2026-10-06", studentName: "Ana Costa", startMinutes: 420, durationMinutes: 60, location: null, note: null, extra: false, status: "AGENDADA", ...over });
const renderAgenda = (classes: TodayClass[], nowMinutes: number) =>
  render(
    <ToastProvider>
      <TodayAgenda classes={classes} nowMinutes={nowMinutes} />
    </ToastProvider>
  );

describe("agenda de hoje no Início do personal (EPIC-48)", () => {
  it("lista as aulas do dia com situação, destaca a próxima e marca feita/falta nas que já começaram", async () => {
    renderAgenda(
      [
        aula({ ref: "a", studentName: "Ana Costa", startMinutes: 420, location: "Academia Centro" }),
        aula({ ref: "b", studentName: "Bia Lima", startMinutes: 540, status: "FALTA" }),
        aula({ ref: "c", studentName: "Caio Reis", startMinutes: 1080 }),
        aula({ ref: "d", studentName: "Davi Melo", startMinutes: 1170, extra: true }),
        aula({ ref: "e", studentName: "Eva Nunes", startMinutes: 1200, status: "DESMARCADA" }),
      ],
      600
    );
    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringMatching(/^07:00Ana CostaAcademia Centro$/),
      expect.stringMatching(/^09:00Bia Lima60 min$/),
      expect.stringMatching(/^18:00Caio Reis60 minPróxima$/),
      expect.stringMatching(/^19:30Davi MeloAvulsa$/),
      expect.stringMatching(/^20:00Eva Nunes60 minDesmarcada$/),
    ]);
    expect(screen.getByRole("link", { name: "Ver semana →" })).toHaveAttribute("href", "/painel/agenda");

    expect(within(items[0]!).getByRole("button", { name: "Falta" }).querySelector("svg")).not.toBeNull();
    expect(within(items[2]!).queryByRole("button")).toBeNull();
    expect(within(items[1]!).getByRole("img", { name: "Falta" })).toBeInTheDocument();
    expect(within(items[1]!).queryByRole("button")).toBeNull();
    await userEvent.click(within(items[0]!).getByRole("button", { name: "Feita" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/agenda/ocorrencia", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ ref: "a", status: "FEITA" }) }));
    expect(refresh).toHaveBeenCalled();
  });

  it("o dia na vertical, com rolagem só na agenda e já perto da hora atual", () => {
    renderAgenda([aula({ ref: "a", startMinutes: 420 }), aula({ ref: "b", studentName: "Bia Lima", startMinutes: 1080 })], 600);
    const timeline = screen.getByLabelText("Aulas de hoje, por horário");
    // Quatro horas de 56 px à vista; 10:00 menos meia hora, a partir das 05:00.
    expect(timeline).toHaveStyle({ height: "224px" });
    expect(timeline.scrollTop).toBe(5 * 56 - 28);
    expect(screen.getByText("05:00")).toBeInTheDocument();
    expect(screen.getByText("22:00")).toBeInTheDocument();
  });

  it("dia sem aulas: só o cartão da agenda, que inteiro abre a agenda", () => {
    renderAgenda([], 600);
    expect(screen.queryByText(/nenhuma aula/)).toBeNull();
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.getByRole("link", { name: /Agenda de hoje/ })).toHaveAttribute("href", "/painel/agenda");
  });
});
