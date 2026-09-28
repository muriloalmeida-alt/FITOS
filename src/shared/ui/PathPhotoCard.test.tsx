import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PathPhotoCard } from "./PathPhotoCard";

describe("PathPhotoCard", () => {
  it("renderiza a foto decorativa (alt vazio), o rótulo, o título e a descrição", () => {
    const { container } = render(
      <PathPhotoCard
        step="01"
        category="PROFISSIONAL"
        title="Sou personal"
        description="Quero gerenciar alunos, treinos e meu negócio."
        image={{ src: "/media/brand/visual-2026/scene-program.png" }}
      >
        <button type="button">Continuar</button>
      </PathPhotoCard>
    );

    expect(container.querySelector('img[alt=""]')).toBeInTheDocument();
    expect(screen.getByText("01 / PROFISSIONAL")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sou personal" })).toBeInTheDocument();
    expect(screen.getByText("Quero gerenciar alunos, treinos e meu negócio.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continuar" })).toBeInTheDocument();
  });
});
