import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider, useToast } from "./Toast";

function Trigger({ onUndo }: { onUndo: () => void }) {
  const toast = useToast();
  return (
    <button type="button" onClick={() => toast.show("R$ 180 recebidos", { label: "Desfazer", onClick: onUndo })}>
      Recebi
    </button>
  );
}

describe("Toast com ação", () => {
  it("mostra Desfazer, chama a ação e some", async () => {
    const onUndo = vi.fn();
    render(
      <ToastProvider>
        <Trigger onUndo={onUndo} />
      </ToastProvider>
    );
    await userEvent.click(screen.getByRole("button", { name: "Recebi" }));
    expect(screen.getByRole("status")).toHaveTextContent("R$ 180 recebidos");
    await userEvent.click(screen.getByRole("button", { name: "Desfazer" }));
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });
});
