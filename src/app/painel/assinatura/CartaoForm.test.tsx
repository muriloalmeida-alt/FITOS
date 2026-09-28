import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CartaoForm } from "./CartaoForm";

const refresh = vi.fn();
const fetchMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

async function fillValidCardFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Nome impresso no cartão"), "Fulano de Tal");
  await user.type(screen.getByLabelText("Número do cartão"), "4111111111111111");
  await user.type(screen.getByLabelText("Mês (MM)"), "10");
  await user.type(screen.getByLabelText("Ano (AAAA)"), "2030");
  await user.type(screen.getByLabelText("CVV"), "123");
  await user.type(screen.getByLabelText("CEP"), "01310100");
  await user.type(screen.getByLabelText("Número do endereço"), "100");
  await user.type(screen.getByLabelText("Celular"), "11987654321");
}

describe("CartaoForm (FIT-128, checkout embutido)", () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllGlobals();
  });

  it("sem cartão cadastrado, já mostra o formulário aberto", () => {
    render(<CartaoForm creditCardLast4={null} creditCardBrand={null} />);

    expect(screen.getByLabelText("Número do cartão")).toBeInTheDocument();
    expect(screen.queryByText(/Cartão terminado em/)).not.toBeInTheDocument();
  });

  it("com cartão já cadastrado, mostra os dados mascarados e um botão para atualizar", async () => {
    const user = userEvent.setup();
    render(<CartaoForm creditCardLast4="1111" creditCardBrand="VISA" />);

    expect(screen.getByText(/Cartão terminado em/)).toBeInTheDocument();
    expect(screen.getByText("1111")).toBeInTheDocument();
    expect(screen.queryByLabelText("Número do cartão")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Atualizar cartão" }));

    expect(screen.getByLabelText("Número do cartão")).toBeInTheDocument();
  });

  it("rejeita salvar com dados inválidos, nunca chama a API", async () => {
    const user = userEvent.setup();
    render(<CartaoForm creditCardLast4={null} creditCardBrand={null} />);

    await user.click(screen.getByRole("button", { name: "Salvar cartão" }));

    expect(await screen.findByText("Informe um número de cartão válido.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("envia o cartão à rota de checkout e atualiza a página em caso de sucesso", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ creditCardLast4: "1111", creditCardBrand: "VISA" }) });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<CartaoForm creditCardLast4={null} creditCardBrand={null} />);

    await fillValidCardFields(user);
    await user.click(screen.getByRole("button", { name: "Salvar cartão" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/tenancy/minha-assinatura/cartao", expect.objectContaining({ method: "POST" }))
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("mostra a mensagem de erro do checkout quando o cartão é recusado", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ message: "Cartão de crédito inválido." }) });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<CartaoForm creditCardLast4={null} creditCardBrand={null} />);

    await fillValidCardFields(user);
    await user.click(screen.getByRole("button", { name: "Salvar cartão" }));

    expect(await screen.findByText("Cartão de crédito inválido.")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });
});
