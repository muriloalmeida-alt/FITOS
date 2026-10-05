import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ToastProvider } from "@/shared/ui";

vi.mock("./usePush", async (original) => ({ ...(await original<typeof import("./usePush")>()), usePush: () => ({ state: "install", enable: vi.fn(), disable: vi.fn() }) }));

describe("instalar no iPhone (EPIC-38)", () => {
  it("fora da Tela de Início, ligar os avisos mostra o passo a passo", async () => {
    const { PushDeviceRow } = await import("./PushDeviceRow");
    render(
      <ToastProvider>
        <PushDeviceRow purpose="Avisos." />
      </ToastProvider>
    );
    expect(screen.getByText("No iPhone, os avisos só chegam com o FitOS instalado na Tela de Início.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Como instalar" }));
    const dialog = screen.getByRole("dialog", { name: "Instale o FitOS no iPhone" });
    expect(dialog).toHaveTextContent("Compartilhar");
    expect(dialog).toHaveTextContent("Adicionar à Tela de Início");
    expect(dialog).toHaveTextContent("Abra o FitOS pelo ícone na Tela de Início");
  });
});
