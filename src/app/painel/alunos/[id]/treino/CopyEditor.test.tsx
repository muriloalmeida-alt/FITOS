import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "@/shared/ui/Toast";
import { CopyEditor } from "./CopyEditor";
import type { StudentCopy } from "@/modules/library/studentCopy";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh }) }));
afterEach(() => vi.restoreAllMocks());

const item = (over: Partial<StudentCopy["workouts"][number]["items"][number]>) => ({ id: "i1", exerciseId: "e1", name: "Agachamento livre", muscle: "Quadríceps", imageUrl: null, imageAlt: null, isCardio: false, sets: 4, reps: 10, durationSeconds: null, load: null, intensity: null, ...over });
const copy: StudentCopy = {
  assignmentId: "a1",
  planId: "p1",
  planName: "Hipertrofia 8 semanas",
  weeks: 8,
  workouts: [{ id: "w1", name: "Inferiores A", days: ["SEGUNDA"], items: [item({}), item({ id: "i2", exerciseId: "c1", name: "Esteira inclinada", muscle: "Aeróbico", isCardio: true, sets: null, reps: null, durationSeconds: 900, intensity: "MODERADO" })] }],
};

function renderEditor() {
  render(
    <ToastProvider>
      <CopyEditor studentId="s1" studentFirstName="Pedro" copy={copy} cardioOptions={[{ id: "c2", name: "Elíptico" }]} />
    </ToastProvider>
  );
}

describe("CopyEditor (EPIC-28)", () => {
  it("tocar no exercício abre opções do mesmo grupo; trocar mostra Desfazer", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (String(url).includes("alternativas")) return new Response(JSON.stringify({ options: [{ id: "e2", name: "Agachamento hack", muscle: "Quadríceps", imageUrl: null, imageAlt: null }] }));
      if (String(url).endsWith("/restaurar")) return new Response(null, { status: 204 });
      return new Response(JSON.stringify({ previousPlanId: "p1", planId: "p2" }));
    });
    renderEditor();
    expect(screen.getByText("Quadríceps")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Trocar Agachamento livre" }));
    const sheet = await screen.findByRole("dialog", { name: "Trocar Agachamento livre" });
    expect(within(sheet).getByText("Outros de Quadríceps")).toBeInTheDocument();
    await userEvent.click(await within(sheet).findByRole("button", { name: /Agachamento hack/ }));
    expect(fetchMock).toHaveBeenCalledWith("/api/students/s1/copia", expect.objectContaining({ body: JSON.stringify({ kind: "swap", itemId: "i1", exerciseId: "e2" }) }));
    expect(await screen.findByText("Agachamento livre → Agachamento hack, só para Pedro")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Desfazer" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/students/s1/copia/restaurar", expect.objectContaining({ body: JSON.stringify({ planId: "p1" }) }));
  });

  it("aeróbico: intensidade com um toque e adicionar aeróbico ao treino", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify({ previousPlanId: "p1", planId: "p2" })));
    renderEditor();
    expect(screen.getByText("15 min")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Moderado" }));
    expect(fetchMock).toHaveBeenLastCalledWith("/api/students/s1/copia", expect.objectContaining({ body: JSON.stringify({ kind: "update", itemId: "i2", intensity: "FORTE" }) }));
    await userEvent.click(screen.getByRole("button", { name: "Adicionar aeróbico" }));
    await userEvent.click(within(screen.getByRole("dialog", { name: "Adicionar aeróbico" })).getByRole("button", { name: /Elíptico/ }));
    expect(fetchMock).toHaveBeenLastCalledWith("/api/students/s1/copia", expect.objectContaining({ body: JSON.stringify({ kind: "addItem", workoutId: "w1", exerciseId: "c2" }) }));
  });

  it("aeróbico com foto no catálogo mostra a foto, não o ícone", () => {
    const withImage: StudentCopy = { ...copy, workouts: [{ ...copy.workouts[0]!, items: [item({ id: "i3", exerciseId: "c3", name: "Bike ergométrica", muscle: "Aeróbico", imageUrl: "https://cdn.test/bike-ergometrica.webp", imageAlt: "Bike ergométrica", isCardio: true, sets: null, reps: null, durationSeconds: 1200, intensity: "MODERADO" })] }] };
    render(
      <ToastProvider>
        <CopyEditor studentId="s1" studentFirstName="Pedro" copy={withImage} cardioOptions={[]} />
      </ToastProvider>
    );
    expect(screen.getByRole("img", { name: "Bike ergométrica" })).toBeInTheDocument();
  });
});
