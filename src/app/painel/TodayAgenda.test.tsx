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
      expect.stringMatching(/^07:00Ana CostaAcademia CentroFeitaFalta$/),
      expect.stringMatching(/^09:00Bia Lima60 minFalta$/),
      expect.stringMatching(/^18:00Caio Reis60 minPróxima$/),
      expect.stringMatching(/^19:30Davi MeloAvulsa$/),
      expect.stringMatching(/^20:00Eva Nunes60 minDesmarcada$/),
    ]);
    expect(screen.getByRole("link", { name: "Ver semana →" })).toHaveAttribute("href", "/painel/agenda");

    await userEvent.click(within(items[0]!).getByRole("button", { name: "Feita" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/agenda/ocorrencia", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ ref: "a", status: "FEITA" }) }));
    expect(refresh).toHaveBeenCalled();
  });

  it("dia sem aulas", () => {
    renderAgenda([], 600);
    expect(screen.getByText(/Nenhuma aula hoje/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Marcar horário" })).toHaveAttribute("href", "/painel/agenda");
  });
});
