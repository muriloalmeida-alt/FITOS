import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { SPLASH_EXIT_MS, SPLASH_MIN_MS, SPLASH_REDUCED_MOTION_MIN_MS, SplashScreen } from "./SplashScreen";

const replace = vi.fn();
const prefetch = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, prefetch }),
}));

function mockReducedMotion(reduced: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reduced && query.includes("reduce"),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

describe("SplashScreen (FIT-141)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockReducedMotion(false);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  it("mostra marca, tagline e carregamento acessível", () => {
    render(<SplashScreen destination="/entrar" />);

    expect(screen.getByRole("img", { name: "FitOS" })).toBeInTheDocument();
    expect(screen.getByText("Treino leva mais longe")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Carregando");
  });

  it("pré-carrega o destino e só troca de rota depois do tempo mínimo, com replace", () => {
    render(<SplashScreen destination="/painel" />);
    expect(prefetch).toHaveBeenCalledWith("/painel");

    act(() => vi.advanceTimersByTime(SPLASH_MIN_MS - 1));
    expect(replace).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1 + SPLASH_EXIT_MS));
    expect(replace).toHaveBeenCalledWith("/painel");
  });

  it("com movimento reduzido, segue quase imediatamente", () => {
    mockReducedMotion(true);
    render(<SplashScreen destination="/entrar" />);

    act(() => vi.advanceTimersByTime(SPLASH_REDUCED_MOTION_MIN_MS + SPLASH_EXIT_MS));
    expect(replace).toHaveBeenCalledWith("/entrar");
  });

  it("não navega se a tela sair antes do fim (sem timer pendurado)", () => {
    const { unmount } = render(<SplashScreen destination="/entrar" />);
    unmount();

    act(() => vi.advanceTimersByTime(SPLASH_MIN_MS + SPLASH_EXIT_MS));
    expect(replace).not.toHaveBeenCalled();
  });
});
