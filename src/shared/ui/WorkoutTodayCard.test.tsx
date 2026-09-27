import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { WorkoutTodayCard } from "./WorkoutTodayCard";

describe("WorkoutTodayCard", () => {
  it("renderiza título, descrição e a ação (href)", () => {
    render(
      <WorkoutTodayCard
        eyebrow="Seu momento"
        title="Força total"
        description="6 exercícios para você se sentir mais forte"
        meta="45 min"
        action={{ label: "Começar meu treino", href: "/painel/treino/sessao" }}
      />
    );
    expect(screen.getByRole("heading", { name: "Força total" })).toBeInTheDocument();
    expect(screen.getByText("6 exercícios para você se sentir mais forte")).toBeInTheDocument();
    expect(screen.getByText("45 min")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Começar meu treino" })).toHaveAttribute("href", "/painel/treino/sessao");
  });

  it("sem imageSrc: não renderiza nenhuma imagem", () => {
    render(<WorkoutTodayCard title="Força total" description="desc" action={{ label: "Começar", href: "/x" }} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("com imageSrc: renderiza a imagem com o alt informado", () => {
    render(
      <WorkoutTodayCard
        title="Força total"
        description="desc"
        imageSrc="/media/landing/treino.webp"
        imageAlt="Personal e aluna celebrando o progresso do treino"
        action={{ label: "Começar", href: "/x" }}
      />
    );
    expect(screen.getByRole("img", { name: "Personal e aluna celebrando o progresso do treino" })).toBeInTheDocument();
  });

  it("action com onClick (sem href): dispara o clique", () => {
    const onClick = vi.fn();
    render(<WorkoutTodayCard title="Força total" description="desc" action={{ label: "Começar", onClick }} />);
    screen.getByRole("button", { name: "Começar" }).click();
    expect(onClick).toHaveBeenCalledOnce();
  });
});
