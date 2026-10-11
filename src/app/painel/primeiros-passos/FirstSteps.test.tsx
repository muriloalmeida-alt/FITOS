import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FirstSteps } from "./FirstSteps";

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

const programs = [
  { id: "prog-45", name: "Corpo todo 3× · 45 min", meta: "2 treinos · 8 semanas" },
  { id: "prog-60", name: "Divisão ABC · 60 min", meta: "2 treinos + 1 aeróbico · 8 semanas" },
];
const empty = { programId: null, programName: null, feeCents: null, feeDay: null };

describe("Primeiro aluno em um minuto (EPIC-33, E4)", () => {
  it("convite, programa e mensalidade, um por vez; o combinado vale para quem entrar pelo link", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      const body = JSON.parse(String(init?.body ?? "{}"));
      return new Response(JSON.stringify(body.programId ? { ...empty, programId: "prog-45", programName: "Corpo todo 3× · 45 min" } : { programId: "prog-45", programName: "Corpo todo 3× · 45 min", feeCents: body.feeCents, feeDay: body.feeDay }));
    });
    render(<FirstSteps url="https://fitos.app/c/abc123" personalFirstName="Murilo" hasStudents={false} programs={programs} defaults={empty} />);
    expect(screen.getByText("0 de 3 · leva menos de um minuto")).toBeInTheDocument();
    const whatsapp = screen.getByRole("link", { name: "WhatsApp" });
    expect(whatsapp.getAttribute("href")).toContain(encodeURIComponent("https://fitos.app/c/abc123"));
    await userEvent.click(whatsapp);

    await userEvent.click(await screen.findByRole("radio", { name: /Corpo todo 3× · 45 min/ }));
    expect(fetchMock).toHaveBeenCalledWith("/api/students/convite-link", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ programId: "prog-45" }) }));
    expect(await screen.findByText("Corpo todo 3× · 45 min · vai junto com o convite")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("radio", { name: /R\$\s150/ }));
    expect(fetchMock).toHaveBeenCalledWith("/api/students/convite-link", expect.objectContaining({ body: JSON.stringify({ feeCents: 15000, feeDay: 10 }) }));
    expect(await screen.findByText(/Tudo pronto/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir para o Início" })).toHaveAttribute("href", "/painel");
  });

  it("dá para fazer depois", () => {
    render(<FirstSteps url="https://fitos.app/c/abc123" personalFirstName="Murilo" hasStudents={false} programs={programs} defaults={empty} />);
    expect(screen.getByRole("link", { name: "Fazer depois" })).toHaveAttribute("href", "/painel");
  });
});
