import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { RestTimer } from "./RestTimer";

/// Avança um segundo por vez, em `act()` separados: o efeito que reagenda o
/// próximo `setTimeout` só é disparado quando o `act()` corrente termina de
/// esvaziar a fila de efeitos — um único `act()` cobrindo vários segundos
/// de uma vez dispara só o primeiro tick (o efeito do 2º/3º tick ainda não
/// tinha sido reagendado quando o timer fake correspondente já teria vencido).
async function tick(times = 1) {
  for (let i = 0; i < times; i += 1) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
  }
}

describe("RestTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renderiza o tempo inicial formatado em MM:SS", () => {
    render(<RestTimer seconds={90} />);
    expect(screen.getByText("01:30")).toBeInTheDocument();
  });

  it("conta regressivamente a cada segundo", async () => {
    render(<RestTimer seconds={5} />);
    expect(screen.getByText("00:05")).toBeInTheDocument();

    await tick();
    expect(screen.getByText("00:04")).toBeInTheDocument();

    await tick(3);
    expect(screen.getByText("00:01")).toBeInTheDocument();
  });

  it("chama onComplete quando chega a zero, uma única vez", async () => {
    const onComplete = vi.fn();
    render(<RestTimer seconds={2} onComplete={onComplete} />);

    await tick(2);
    expect(screen.getByText("00:00")).toBeInTheDocument();
    expect(onComplete).toHaveBeenCalledOnce();

    await tick(2);
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("usa o rótulo customizado quando informado", () => {
    render(<RestTimer seconds={30} label="Descanso" />);
    expect(screen.getByText("Descanso")).toBeInTheDocument();
  });
});
