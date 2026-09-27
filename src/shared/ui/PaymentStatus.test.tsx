import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PaymentStatus } from "./PaymentStatus";

describe("PaymentStatus", () => {
  it.each([
    ["PENDENTE", "Pendente"],
    ["PAGO", "Pago"],
    ["ATRASADO", "Atrasado"],
    ["CANCELADO", "Cancelado"],
  ] as const)("renderiza o rótulo em português para %s", (status, label) => {
    render(<PaymentStatus status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("cada estado tem um símbolo textual distinto — nunca só a cor", () => {
    const { unmount } = render(<PaymentStatus status="PAGO" />);
    expect(screen.getByText("✓")).toBeInTheDocument();
    unmount();

    const { unmount: unmount2 } = render(<PaymentStatus status="ATRASADO" />);
    expect(screen.getByText("!")).toBeInTheDocument();
    unmount2();

    render(<PaymentStatus status="CANCELADO" />);
    expect(screen.getByText("✕")).toBeInTheDocument();
  });
});
