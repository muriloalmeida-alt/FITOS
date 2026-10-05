import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ToastProvider } from "@/shared/ui";
import { EvolutionPhotos } from "./EvolutionPhotos";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const photos = [
  { id: "p3", pose: "FRENTE" as const, takenIso: "2026-10-05T15:00:00Z" },
  { id: "p2", pose: "LADO" as const, takenIso: "2026-10-05T15:01:00Z" },
  { id: "p1", pose: "FRENTE" as const, takenIso: "2026-08-01T15:00:00Z" },
];

describe("EvolutionPhotos (EPIC-35)", () => {
  it("o personal declara a autorização do aluno antes da primeira foto", () => {
    render(
      <ToastProvider>
        <EvolutionPhotos photos={[]} consent={false} owner={{ kind: "personal", studentId: "s1", firstName: "Ana" }} />
      </ToastProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: /Adicionar fotos/ }));
    const dialog = screen.getByRole("dialog", { name: "Fotos de Ana" });
    expect(within(dialog).getByText(/peça a autorização de Ana/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ana autorizou" })).toBeInTheDocument();
  });

  it("com autorização vai direto para frente, lado ou costas", () => {
    render(
      <ToastProvider>
        <EvolutionPhotos photos={[]} consent owner={{ kind: "self", audience: "você" }} />
      </ToastProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: /Adicionar fotos/ }));
    const dialog = screen.getByRole("dialog", { name: "Qual foto?" });
    for (const pose of ["Frente", "Lado", "Costas"]) expect(within(dialog).getByText(pose)).toBeInTheDocument();
  });

  it("agrupa por data, compara antes e agora pela mesma pose e abre a foto para excluir", () => {
    render(
      <ToastProvider>
        <EvolutionPhotos photos={photos} consent owner={{ kind: "self", audience: "você e Murilo" }} />
      </ToastProvider>
    );
    expect(screen.getByText("Antes e agora")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Frente em 1 de ago. de 2026" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Frente em 5 de out. de 2026" })).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /^Lado em 1 de ago/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Lado em 5 de out. de 2026" }));
    const dialog = screen.getByRole("dialog", { name: "Lado · 5 de out. de 2026" });
    expect(within(dialog).getByRole("img", { name: "Lado" })).toHaveAttribute("src", "/api/fotos-evolucao/p2");
    expect(screen.getByRole("button", { name: "Excluir foto" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retirar autorização das fotos" })).toBeInTheDocument();
  });
});
