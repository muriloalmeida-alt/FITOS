import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { forceUpdate } from "./forceUpdate";
import { UpdateVersion } from "./UpdateVersion";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Atualizar versão (escondido)", () => {
  it("só mostra a versão; cinco toques revelam o botão com a versão no ar", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify({ version: "abc1234" })))));
    render(<UpdateVersion />);
    const label = screen.getByRole("button", { name: /^Versão / });
    for (let i = 0; i < 4; i++) fireEvent.click(label);
    expect(screen.queryByRole("button", { name: "Atualizar versão" })).not.toBeInTheDocument();
    await act(async () => {
      fireEvent.click(label);
    });
    expect(screen.getByRole("button", { name: "Atualizar versão" })).toBeInTheDocument();
    expect(screen.getByText("abc1234")).toBeInTheDocument();
    expect(screen.getByText(/versão mais nova/)).toBeInTheDocument();
  });

  it("atualiza o service worker sem desregistrar, apaga o Cache Storage e recarrega sem cache", async () => {
    const update = vi.fn(() => Promise.resolve());
    const unregister = vi.fn();
    const deleted: string[] = [];
    const replace = vi.fn();
    const fakeWindow = {
      navigator: { serviceWorker: { getRegistrations: () => Promise.resolve([{ update, unregister }]) } },
      caches: { keys: () => Promise.resolve(["a", "b"]), delete: (key: string) => Promise.resolve(Boolean(deleted.push(key))) },
      location: { href: "https://app.fitos.test/painel/perfil?x=1", replace },
    } as unknown as Window;
    vi.spyOn(Date, "now").mockReturnValue(42);
    await forceUpdate(fakeWindow);
    expect(update).toHaveBeenCalled();
    expect(unregister).not.toHaveBeenCalled();
    expect(deleted).toEqual(["a", "b"]);
    expect(replace).toHaveBeenCalledWith("https://app.fitos.test/painel/perfil?x=1&atualizado=42");
  });
});
