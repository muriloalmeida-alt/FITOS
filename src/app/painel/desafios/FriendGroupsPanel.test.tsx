import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { FriendGroupsPanel } from "./FriendGroupsPanel";

afterEach(() => vi.restoreAllMocks());

describe("Amigos", () => {
  it("lista os grupos com a posição e a temporada", () => {
    render(
      <FriendGroupsPanel
        nowIso="2026-10-09T12:00:00.000Z"
        groups={[{ id: "g1", name: "Corrida", mode: "TOTAL", members: 3, season: { lengthDays: 7, startsAt: "2026-10-05T12:00:00.000Z", endsAt: "2026-10-12T12:00:00.000Z", running: true }, myPosition: 2 }]}
      />
    );
    expect(screen.getByRole("link", { name: /Corrida/ })).toHaveAttribute("href", "/painel/desafios/amigos/g1");
    expect(screen.getByText("3 pessoas · Pontos totais · Temporada de 7 dias · faltam 3 dias")).toBeInTheDocument();
    expect(screen.getByText("2º")).toBeInTheDocument();
  });

  it("sem grupo abre o formulário; cria com modo e temporada e vai para o grupo", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ groupId: "g9", inviteCode: "ABCD2345" }), { status: 201 }));
    render(<FriendGroupsPanel nowIso="2026-10-09T12:00:00.000Z" groups={[]} />);
    expect(screen.getByText(/Só contam treinos com foto/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Nome do grupo"), "Força");
    await userEvent.click(screen.getByRole("radio", { name: "Pontos totais" }));
    await userEvent.click(screen.getByRole("radio", { name: "28 dias" }));
    await userEvent.click(screen.getByRole("button", { name: "Criar e começar a temporada" }));
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1]!.body))).toEqual({ name: "Força", mode: "TOTAL", lengthDays: 28 });
    expect(router.push).toHaveBeenCalledWith("/painel/desafios/amigos/g9");
  });

  it("entrar com código leva ao convite, onde aparecem as regras", async () => {
    render(<FriendGroupsPanel nowIso="2026-10-09T12:00:00.000Z" groups={[]} />);
    await userEvent.click(screen.getByRole("button", { name: "Entrar com código" }));
    await userEvent.type(screen.getByLabelText("Código do convite"), "k7qx2m9p");
    await userEvent.click(screen.getByRole("button", { name: "Ver o grupo" }));
    expect(router.push).toHaveBeenCalledWith("/painel/desafios/amigos/convite/K7QX2M9P");
  });
});
