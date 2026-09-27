import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AchievementCard } from "./AchievementCard";

describe("AchievementCard", () => {
  it("renderiza título e descrição, ícone oculto do leitor de tela", () => {
    render(<AchievementCard icon="★" title="Seu melhor ciclo" description="12 semanas de consistência" />);
    expect(screen.getByText("Seu melhor ciclo")).toBeInTheDocument();
    expect(screen.getByText("12 semanas de consistência")).toBeInTheDocument();
    expect(screen.getByText("★")).toHaveAttribute("aria-hidden", "true");
  });
});
