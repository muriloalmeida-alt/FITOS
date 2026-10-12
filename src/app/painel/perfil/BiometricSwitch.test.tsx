import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "@/shared/ui";
import { BiometricSwitch } from "./BiometricSwitch";

const listUserPasskeys = vi.fn();
const addPasskey = vi.fn();
const deletePasskey = vi.fn();
const available = vi.fn();

vi.mock("@/modules/identity/auth-client", () => ({
  authClient: { passkey: { listUserPasskeys: () => listUserPasskeys(), addPasskey: (...args: unknown[]) => addPasskey(...args), deletePasskey: (...args: unknown[]) => deletePasskey(...args) } },
}));
vi.mock("../../_entrada/rememberedAccount", async () => {
  const actual = await vi.importActual<typeof import("../../_entrada/rememberedAccount")>("../../_entrada/rememberedAccount");
  return { ...actual, platformPasskeyAvailable: () => available() };
});

function renderSwitch() {
  render(
    <ToastProvider>
      <ul>
        <BiometricSwitch />
      </ul>
    </ToastProvider>
  );
  return screen.getByRole("switch", { name: /Entrar com biometria/ });
}

beforeEach(() => {
  window.localStorage.clear();
  available.mockResolvedValue(true);
  listUserPasskeys.mockResolvedValue({ data: [] });
});
afterEach(() => vi.resetAllMocks());

describe("Entrar com biometria (proposta 10)", () => {
  it("desativada: ativar cria a passkey deste aparelho e só então liga", async () => {
    addPasskey.mockResolvedValue({ data: { id: "pk-1" }, error: null });
    const control = renderSwitch();
    await waitFor(() => expect(screen.getByText("Desativada neste aparelho")).toBeInTheDocument());
    expect(control).toHaveAttribute("aria-checked", "false");
    await userEvent.click(control);
    await waitFor(() => expect(control).toHaveAttribute("aria-checked", "true"));
    expect(screen.getByText("Ativada neste aparelho")).toBeInTheDocument();
    expect(addPasskey).toHaveBeenCalledWith(expect.objectContaining({ authenticatorAttachment: "platform" }));
    expect(window.localStorage.getItem("fitos:passkey-aparelho")).toBe("pk-1");
  });

  it("ativada só quando a passkey deste aparelho ainda existe na conta; desativar remove só ela", async () => {
    window.localStorage.setItem("fitos:passkey-aparelho", "pk-1");
    listUserPasskeys.mockResolvedValue({ data: [{ id: "pk-1" }, { id: "pk-outro" }] });
    deletePasskey.mockResolvedValue({ data: {}, error: null });
    const control = renderSwitch();
    await waitFor(() => expect(control).toHaveAttribute("aria-checked", "true"));
    await userEvent.click(control);
    await waitFor(() => expect(control).toHaveAttribute("aria-checked", "false"));
    expect(deletePasskey).toHaveBeenCalledTimes(1);
    expect(deletePasskey).toHaveBeenCalledWith({ id: "pk-1" });
  });

  it("passkey removida em outro lugar aparece como desativada", async () => {
    window.localStorage.setItem("fitos:passkey-aparelho", "pk-1");
    listUserPasskeys.mockResolvedValue({ data: [{ id: "pk-outro" }] });
    const control = renderSwitch();
    await waitFor(() => expect(screen.getByText("Desativada neste aparelho")).toBeInTheDocument());
    expect(control).toHaveAttribute("aria-checked", "false");
  });

  it("aparelho sem biometria: indisponível e desabilitado", async () => {
    available.mockResolvedValue(false);
    const control = renderSwitch();
    await waitFor(() => expect(screen.getByText("Indisponível neste aparelho")).toBeInTheDocument());
    expect(control).toBeDisabled();
  });

  it("falha na autenticação mantém o estado anterior e explica", async () => {
    addPasskey.mockResolvedValue({ data: null, error: { message: "cancelado" } });
    const control = renderSwitch();
    await waitFor(() => expect(screen.getByText("Desativada neste aparelho")).toBeInTheDocument());
    await userEvent.click(control);
    expect(await screen.findByRole("alert")).toHaveTextContent(/Não foi possível ativar/);
    expect(control).toHaveAttribute("aria-checked", "false");
    expect(window.localStorage.getItem("fitos:passkey-aparelho")).toBeNull();
  });
});
