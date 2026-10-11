import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const signInEmail = vi.fn();
const signInPasskey = vi.fn();
const addPasskey = vi.fn();
const getSession = vi.fn();
const push = vi.fn();
const searchParamsGet = vi.fn().mockReturnValue(null);

vi.mock("@/modules/identity/auth-client", () => ({
  signIn: { email: (...args: unknown[]) => signInEmail(...args), passkey: (...args: unknown[]) => signInPasskey(...args) },
  authClient: { passkey: { addPasskey: (...args: unknown[]) => addPasskey(...args) }, getSession: (...args: unknown[]) => getSession(...args) },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
  useSearchParams: () => ({ get: searchParamsGet }),
}));

const okUser = { data: { user: { name: "Murilo Almeida", email: "murilo@studio.com", role: "PERSONAL" } }, error: null };

function setPlatformPasskey(available: boolean) {
  Object.defineProperty(window, "PublicKeyCredential", {
    configurable: true,
    value: available ? { isUserVerifyingPlatformAuthenticatorAvailable: async () => true } : undefined,
  });
}

async function renderForm() {
  const { EntrarForm } = await import("./EntrarForm");
  render(<EntrarForm />);
}

describe("Entrar (EPIC-33)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setPlatformPasskey(false);
  });
  afterEach(() => {
    vi.resetAllMocks();
    searchParamsGet.mockReturnValue(null);
  });

  it("valida e-mail e senha antes de enviar", async () => {
    await renderForm();
    await userEvent.click(await screen.findByRole("button", { name: "Entrar" }));
    expect(screen.getByText("Informe um e-mail válido.")).toBeInTheDocument();
    expect(screen.getByText("Informe sua senha.")).toBeInTheDocument();
    expect(signInEmail).not.toHaveBeenCalled();
  });

  it("credencial errada: mensagem genérica junto da senha; 429 explica a espera", async () => {
    signInEmail.mockResolvedValueOnce({ error: { status: 401 } }).mockResolvedValueOnce({ error: { status: 429 } });
    await renderForm();
    await userEvent.type(await screen.findByLabelText("E-mail"), "a@b.com");
    await userEvent.type(screen.getByLabelText("Senha"), "errada");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByText("E-mail ou senha inválidos. Confira e tente de novo.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByText(/Muitas tentativas seguidas/)).toBeInTheDocument();
  });

  it("entra, lembra a conta neste aparelho e respeita só redirecionamento interno", async () => {
    signInEmail.mockResolvedValue(okUser);
    searchParamsGet.mockReturnValue("/painel/alunos");
    await renderForm();
    await userEvent.type(await screen.findByLabelText("E-mail"), "Murilo@Studio.com");
    await userEvent.type(screen.getByLabelText("Senha"), "senha-forte-123");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(signInEmail).toHaveBeenCalledWith({ email: "murilo@studio.com", password: "senha-forte-123" });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/painel/alunos"));
    expect(JSON.parse(window.localStorage.getItem("fitos:conta")!)).toMatchObject({ name: "Murilo Almeida", role: "PERSONAL", passkey: false });
  });

  it("ignora redirecionamento externo", async () => {
    signInEmail.mockResolvedValue(okUser);
    searchParamsGet.mockReturnValue("https://evil.example");
    await renderForm();
    await userEvent.type(await screen.findByLabelText("E-mail"), "murilo@studio.com");
    await userEvent.type(screen.getByLabelText("Senha"), "senha-forte-123");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/painel"));
  });

  it("conta lembrada: Continuar como Murilo pede só a senha", async () => {
    window.localStorage.setItem("fitos:conta", JSON.stringify({ name: "Murilo Almeida", email: "murilo@studio.com", role: "PERSONAL", passkey: false }));
    signInEmail.mockResolvedValue(okUser);
    await renderForm();
    await userEvent.click(await screen.findByRole("button", { name: /Continuar como Murilo/ }));
    expect(screen.queryByLabelText("E-mail")).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Senha"), "senha-forte-123");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(signInEmail).toHaveBeenCalledWith({ email: "murilo@studio.com", password: "senha-forte-123" });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/painel"));
  });

  it("aparelho com biometria: depois da senha oferece ligar digital/Face ID uma vez", async () => {
    setPlatformPasskey(true);
    signInEmail.mockResolvedValue(okUser);
    addPasskey.mockResolvedValue({ data: {}, error: null });
    await renderForm();
    await userEvent.type(await screen.findByLabelText("E-mail"), "murilo@studio.com");
    await userEvent.type(screen.getByLabelText("Senha"), "senha-forte-123");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    const ativar = await screen.findByRole("button", { name: "Ativar" });
    expect(push).not.toHaveBeenCalled();
    await userEvent.click(ativar);
    expect(addPasskey).toHaveBeenCalledWith({ name: "Este aparelho" });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/painel"));
    expect(JSON.parse(window.localStorage.getItem("fitos:conta")!)).toMatchObject({ passkey: true });
    expect(window.localStorage.getItem("fitos:passkey:oferecido")).toBe("murilo@studio.com");
  });

  it("conta com passkey: entra com digital ou Face ID sem digitar nada", async () => {
    setPlatformPasskey(true);
    window.localStorage.setItem("fitos:conta", JSON.stringify({ name: "Murilo Almeida", email: "murilo@studio.com", role: "PERSONAL", passkey: true }));
    signInPasskey.mockResolvedValue({ data: {}, error: null });
    getSession.mockResolvedValue({ data: { user: okUser.data.user } });
    await renderForm();
    await userEvent.click(await screen.findByRole("button", { name: "Entrar com digital ou Face ID" }));
    expect(signInPasskey).toHaveBeenCalled();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/painel"));
    expect(signInEmail).not.toHaveBeenCalled();
  });
});
