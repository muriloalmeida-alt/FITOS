import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MediaAttribution } from "./MediaAttribution";

describe("MediaAttribution", () => {
  it("renderiza o crédito informado", () => {
    render(<MediaAttribution credit="Foto: banco de imagens FitOS" />);
    expect(screen.getByText("Foto: banco de imagens FitOS")).toBeInTheDocument();
  });
});
