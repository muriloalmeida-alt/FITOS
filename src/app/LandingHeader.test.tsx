import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LandingHeader } from "./LandingHeader";

describe("LandingHeader (FIT-110)", () => {
  it("renderiza a marca e os links de navegação", () => {
    render(<LandingHeader appName="FitOS" />);
    expect(screen.getByRole("link", { name: "FitOS" })).toHaveAttribute("href", "/");
    expect(screen.getAllByRole("link", { name: "Recursos" })[0]).toHaveAttribute("href", "#recursos");
    expect(screen.getAllByRole("link", { name: "Para quem" })[0]).toHaveAttribute("href", "#para-quem");
  });

  it("menu mobile começa fechado (aria-expanded=false) e alterna ao clicar", async () => {
    const user = userEvent.setup();
    render(<LandingHeader appName="FitOS" />);

    const toggle = screen.getByRole("button", { name: "Abrir menu" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("navigation", { name: "Navegação principal (mobile)" })).not.toBeInTheDocument();

    await user.click(toggle);

    expect(screen.getByRole("button", { name: "Fechar menu" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("navigation", { name: "Navegação principal (mobile)" })).toBeInTheDocument();
  });

  it("clicar num link do menu mobile fecha o menu", async () => {
    const user = userEvent.setup();
    render(<LandingHeader appName="FitOS" />);

    await user.click(screen.getByRole("button", { name: "Abrir menu" }));
    const mobileNav = screen.getByRole("navigation", { name: "Navegação principal (mobile)" });
    await user.click(within(mobileNav).getByRole("link", { name: "Entrar" }));

    expect(screen.queryByRole("navigation", { name: "Navegação principal (mobile)" })).not.toBeInTheDocument();
  });
});
