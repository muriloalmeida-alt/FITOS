import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/shared/ui", async (original) => ({ ...(await original<typeof import("@/shared/ui")>()), useToast: () => ({ show: vi.fn() }) }));
const { ShareLinkButton } = await import("./ShareLinkButton");

describe("ShareLinkButton", () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, "share");
  });

  it("manda o texto e o link juntos (sem o campo url, que faz o WhatsApp descartar o texto)", async () => {
    const share = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
    render(<ShareLinkButton path="/i/abc23" text="Oi! Vem treinar comigo:" label="Convidar" />);
    await userEvent.click(screen.getByRole("button", { name: "Convidar" }));
    expect(share).toHaveBeenCalledWith({ text: `Oi! Vem treinar comigo:\n\n${window.location.origin}/i/abc23` });
  });
});
