import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "@/shared/ui";
import { CrmView, type CrmRow } from "./CrmView";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh }) }));
afterEach(() => {
  vi.restoreAllMocks();
  refresh.mockReset();
});

const row = (overrides: Partial<CrmRow> = {}): CrmRow => ({
  id: "p1",
  name: "Ana Lima",
  phoneLabel: "(11) 98765-4321",
  email: null,
  note: null,
  status: "NOVO",
  couponCode: "CONHECA-ABC123",
  inviteCount: 0,
  message: "Olá, Ana! Conheça o FitOS...",
  whatsappUrl: "https://wa.me/5511987654321?text=Ol%C3%A1",
  timeline: ["cadastrado em 12 out."],
  ...overrides,
});

function renderView(rows: CrmRow[], queue = rows.filter((entry) => entry.status === "NOVO")) {
  render(
    <ToastProvider>
      <CrmView rows={rows} queue={queue} />
    </ToastProvider>
  );
}

describe("CRM de convites (admin)", () => {
  it("fila de envio: um toque abre o WhatsApp do próximo contato novo e conta o envio", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
    renderView([row(), row({ id: "p2", name: "Bruno Souza", status: "CONVIDADO", inviteCount: 1 })]);
    const queue = screen.getByRole("region", { name: "Fila de envio" });
    expect(within(queue).getByText(/1 contato novo/)).toBeInTheDocument();
    const send = within(queue).getByRole("link", { name: "Enviar para Ana Lima" });
    expect(send).toHaveAttribute("href", "https://wa.me/5511987654321?text=Ol%C3%A1");
    expect(send).toHaveAttribute("target", "_blank");
    send.addEventListener("click", (event) => event.preventDefault());
    await userEvent.click(send);
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/crm/p1/enviado", expect.objectContaining({ method: "POST" }));
    expect(screen.getByRole("link", { name: "Reenviar no WhatsApp" })).toBeInTheDocument();
    expect(screen.getAllByText(/cupom CONHECA-ABC123/, { selector: "span" }).length).toBeGreaterThan(0);
  });

  it("adicionar contato envia nome e celular; importar lista mostra criados, repetidos e linhas com problema", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) =>
      String(url).endsWith("/lote")
        ? new Response(JSON.stringify({ created: 2, duplicates: [{ line: 3, name: "Ana Lima" }], errors: [{ line: 4, text: "Davi; 123", message: "Celular inválido." }] }), { status: 200 })
        : new Response(JSON.stringify({ id: "p9" }), { status: 201 })
    );
    renderView([]);
    expect(screen.getByText(/Nenhum contato aqui/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Adicionar contato" }));
    const add = screen.getByRole("dialog", { name: "Adicionar contato" });
    expect(within(add).getByRole("button", { name: "Adicionar" })).toBeDisabled();
    await userEvent.type(within(add).getByLabelText("Nome"), "Carla Dias");
    await userEvent.type(within(add).getByLabelText("Celular (WhatsApp)"), "31976543210");
    await userEvent.click(within(add).getByRole("button", { name: "Adicionar" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/crm", expect.objectContaining({ body: JSON.stringify({ name: "Carla Dias", phone: "31976543210", email: "", note: "" }) }));

    await userEvent.click(screen.getByRole("button", { name: "Importar lista ou agenda" }));
    const bulk = screen.getByRole("dialog", { name: "Importar lista" });
    await userEvent.type(within(bulk).getByLabelText("Lista"), "Eva; 11 91234-5678");
    await userEvent.click(within(bulk).getByRole("button", { name: "Importar" }));
    const status = await within(bulk).findByRole("status");
    expect(status).toHaveTextContent("2 contatos adicionados, cada um com o próprio cupom.");
    expect(status).toHaveTextContent("Já estavam no CRM (linhas 3): Ana Lima.");
    expect(within(status).getByText("Linha 4 (Davi; 123): Celular inválido.")).toBeInTheDocument();
  });

  it("descartar pede confirmação; cadastrado não tem envio nem descarte", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
    renderView([row({ status: "CONVIDADO", inviteCount: 1 }), row({ id: "p3", name: "Iara Melo", status: "CADASTRADO" })], []);
    const items = screen.getAllByRole("listitem");
    expect(within(items[1]!).queryByRole("link", { name: /WhatsApp/ })).not.toBeInTheDocument();
    expect(within(items[1]!).queryByRole("button", { name: "Descartar" })).not.toBeInTheDocument();
    await userEvent.click(within(items[0]!).getByRole("button", { name: "Descartar" }));
    await userEvent.click(within(screen.getByRole("dialog", { name: "Descartar Ana Lima?" })).getByRole("button", { name: "Descartar" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/crm/p1/descartar", expect.objectContaining({ method: "POST" }));
  });

  it("agenda do celular (Android): escolhe vários contatos e só os celulares válidos entram na lista para revisar", async () => {
    const select = vi.fn(async () => [
      { name: ["Ana Lima"], tel: ["+55 11 98765-4321"] },
      { name: ["Bruno Souza"], tel: ["(21) 3456-7890", "21998765432"] },
      { name: ["Fixo Só"], tel: ["(31) 3333-4444"] },
    ]);
    Object.defineProperty(navigator, "contacts", { value: { select }, configurable: true });
    try {
      renderView([]);
      await userEvent.click(screen.getByRole("button", { name: "Importar lista ou agenda" }));
      const bulk = screen.getByRole("dialog", { name: "Importar lista" });
      await userEvent.click(within(bulk).getByRole("button", { name: "Escolher da agenda do celular" }));
      expect(select).toHaveBeenCalledWith(["name", "tel"], { multiple: true });
      expect(within(bulk).getByLabelText("Lista")).toHaveValue("Ana Lima; (11) 98765-4321\nBruno Souza; (21) 99876-5432");
      expect(within(bulk).getByRole("status")).toHaveTextContent("2 contatos entraram na lista. Sem celular válido: Fixo Só.");
    } finally {
      Reflect.deleteProperty(navigator, "contacts");
    }
  });

  it("iPhone: sem agenda no navegador, explica a opção do Safari e o .vcf; o arquivo de contatos vira a lista", async () => {
    renderView([]);
    await userEvent.click(screen.getByRole("button", { name: "Importar lista ou agenda" }));
    const bulk = screen.getByRole("dialog", { name: "Importar lista" });
    expect(within(bulk).queryByRole("button", { name: "Escolher da agenda do celular" })).not.toBeInTheDocument();
    expect(within(bulk).getByText(/Contact Picker API/)).toBeInTheDocument();
    expect(within(bulk).getByText(/Plano B: em Contatos/)).toBeInTheDocument();
    const vcf = new File(["BEGIN:VCARD\nVERSION:3.0\nFN:Carla Dias\nTEL;type=CELL:31976543210\nEND:VCARD\n"], "contatos.vcf", { type: "text/vcard" });
    await userEvent.upload(within(bulk).getByLabelText(/arquivo de contatos/), vcf);
    expect(await within(bulk).findByRole("status")).toHaveTextContent("1 contato entrou na lista.");
    expect(within(bulk).getByLabelText("Lista")).toHaveValue("Carla Dias; (31) 97654-3210");
  });
});
