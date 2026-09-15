import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card } from "./Card";

describe("Card", () => {
  it("renderiza título e conteúdo", () => {
    render(
      <Card title="Título de teste">
        <p>Conteúdo de teste</p>
      </Card>
    );

    expect(screen.getByRole("heading", { name: "Título de teste" })).toBeInTheDocument();
    expect(screen.getByText("Conteúdo de teste")).toBeInTheDocument();
  });
});
