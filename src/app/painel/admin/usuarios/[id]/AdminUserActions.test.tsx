import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminUserActions } from "./AdminUserActions";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

afterEach(() => vi.restoreAllMocks());

const user = { id: "u1", email: "pedro@ex.test", name: "Pedro", hasPassword: true };

describe("AdminUserActions", () => {
  it("troca a senha e avisa que a pessoa precisa entrar de novo", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
    render(<AdminUserActions user={user} canChangePassword canDelete losses={["Tudo"]} />);
    await userEvent.type(screen.getByLabelText("Nova senha"), "nova-senha-123");
    await userEvent.click(screen.getByRole("button", { name: "Salvar nova senha" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/usuarios/u1/senha", expect.objectContaining({ method: "POST", body: JSON.stringify({ password: "nova-senha-123" }) }));
    expect(await screen.findByText(/Senha alterada/)).toBeInTheDocument();
  });

  it("só libera a exclusão com o e-mail digitado e volta para a lista", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    render(<AdminUserActions user={user} canChangePassword canDelete losses={["O espaço inteiro"]} />);
    expect(screen.getByText("O espaço inteiro")).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Excluir usuário e tudo o que é dele" });
    expect(button).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Para confirmar, digite pedro@ex.test"), "pedro@ex.test");
    expect(button).toBeEnabled();
    await userEvent.click(button);
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/usuarios/u1", expect.objectContaining({ method: "DELETE" }));
    expect(router.push).toHaveBeenCalledWith("/painel/admin");
  });

  it("sem permissão, não mostra as ações", () => {
    render(<AdminUserActions user={user} canChangePassword={false} canDelete={false} losses={[]} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
