import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

let pathname = "/painel";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

function liveVersion(version: string) {
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify({ version })))));
}

async function renderBanner() {
  vi.resetModules();
  const { NewVersionBanner } = await import("./NewVersionBanner");
  await act(async () => {
    render(<NewVersionBanner />);
  });
}

describe("Aviso de versão nova", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_APP_VERSION", "aaa1111");
    pathname = "/painel";
    window.sessionStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("aparece quando a versão no ar é outra; Depois esconde até a próxima versão", async () => {
    liveVersion("bbb2222");
    await renderBanner();
    expect(screen.getByText("Nova versão disponível")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Atualizar" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Depois" }));
    expect(screen.queryByText("Nova versão disponível")).not.toBeInTheDocument();
    expect(window.sessionStorage.getItem("fitos:versao:adiada")).toBe("bbb2222");
  });

  it("não aparece com a mesma versão nem durante o treino ao vivo", async () => {
    liveVersion("aaa1111");
    await renderBanner();
    expect(screen.queryByText("Nova versão disponível")).not.toBeInTheDocument();

    liveVersion("bbb2222");
    pathname = "/painel/meus-treinos/sessao";
    await renderBanner();
    expect(screen.queryByText("Nova versão disponível")).not.toBeInTheDocument();
  });
});
