import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GlobalError from "./error";

describe("GlobalError (limite de erro do segmento app/)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("mostra um estado de erro recuperável, nunca a mensagem técnica do erro", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("stack trace interno sensível");
    render(<GlobalError error={error} reset={vi.fn()} />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText("stack trace interno sensível")).not.toBeInTheDocument();
  });

  it("registra o erro no console para diagnóstico", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("falha real");
    render(<GlobalError error={error} reset={vi.fn()} />);

    expect(consoleSpy).toHaveBeenCalledWith(error);
  });

  it("botão 'Tentar novamente' chama reset()", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const reset = vi.fn();
    const user = userEvent.setup();
    render(<GlobalError error={new Error("falha")} reset={reset} />);

    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(reset).toHaveBeenCalledOnce();
  });
});
