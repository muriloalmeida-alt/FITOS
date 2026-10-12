import { describe, expect, it } from "vitest";
import { formatMobile, inviteMessage, normalizeBrazilianMobile, parseBulk, parseProspect, whatsappLink } from "./crm";

describe("CRM: celular", () => {
  it("normaliza formatos comuns e recusa fixo, DDD inválido e tamanho errado", () => {
    expect(normalizeBrazilianMobile("(11) 98765-4321")).toBe("5511987654321");
    expect(normalizeBrazilianMobile("+55 11 98765 4321")).toBe("5511987654321");
    expect(normalizeBrazilianMobile("11987654321")).toBe("5511987654321");
    expect(normalizeBrazilianMobile("(11) 3456-7890")).toBeNull();
    expect(normalizeBrazilianMobile("(01) 98765-4321")).toBeNull();
    expect(normalizeBrazilianMobile("987654321")).toBeNull();
    expect(formatMobile("5511987654321")).toBe("(11) 98765-4321");
  });

  it("contato: nome, celular, e-mail opcional", () => {
    expect(parseProspect({ name: "  Ana   Lima ", phone: "11987654321", email: "ANA@EX.TEST" })).toEqual({ name: "Ana Lima", phone: "5511987654321", email: "ana@ex.test", note: null });
    expect(() => parseProspect({ name: "A", phone: "11987654321" })).toThrow(/nome/);
    expect(() => parseProspect({ name: "Ana", phone: "123" })).toThrow(/Celular/);
    expect(() => parseProspect({ name: "Ana", phone: "11987654321", email: "x" })).toThrow(/E-mail/);
  });
});

describe("CRM: lote", () => {
  it("aceita ; , e tab, ignora cabeçalho e linhas vazias, aponta erros e repetidos por linha", () => {
    const parsed = parseBulk(["nome;celular;email", "Ana Lima; (11) 98765-4321; ana@ex.test", "", "Bruno, 21 99876-5432", "Carla\t+55 31 97654-3210", "Davi; 1234", "Ana de novo; 11987654321"].join("\n"));
    expect(parsed.valid.map((entry) => [entry.name, entry.phone, entry.line])).toEqual([
      ["Ana Lima", "5511987654321", 2],
      ["Bruno", "5521998765432", 4],
      ["Carla", "5531976543210", 5],
    ]);
    expect(parsed.errors.map((entry) => [entry.line, entry.message])).toEqual([
      [6, expect.stringMatching(/Celular inválido/)],
      [7, "Celular repetido na lista."],
    ]);
  });

  it("limite por importação", () => {
    const many = Array.from({ length: 201 }, (_, index) => `Pessoa ${index}; 11 9${String(10_000_000 + index).padStart(8, "0")}`).join("\n");
    expect(() => parseBulk(many)).toThrow(/No máximo 200/);
  });
});

describe("CRM: mensagem", () => {
  it("Conheça o FitOS com o primeiro nome, o cupom e o link; wa.me com a mensagem codificada", () => {
    const message = inviteMessage({ name: "Ana Lima", couponCode: "CONHECA-ABC123", link: "https://fitos.app/conheca/tok" });
    expect(message).toMatch(/^Olá, Ana! Conheça o FitOS/);
    expect(message).toContain("30 dias grátis");
    expect(message).toContain("50% de desconto nos 30 dias seguintes com o cupom CONHECA-ABC123");
    expect(message.endsWith("https://fitos.app/conheca/tok")).toBe(true);
    expect(whatsappLink("5511987654321", "Oi & tchau")).toBe("https://wa.me/5511987654321?text=Oi%20%26%20tchau");
  });
});

describe("CRM: agenda do celular", () => {
  it("vCard do iPhone e do Android: vários cartões, linhas dobradas, item1.TEL, N sem FN e celular escolhido entre os números", async () => {
    const { parseVcard, contactsToLines } = await import("./crm");
    const vcf = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      "N:Lima;Ana;;;",
      "FN:Ana Lima",
      "item1.TEL;type=CELL;type=pref:+55 11 98765-4321",
      "END:VCARD",
      "BEGIN:VCARD",
      "VERSION:2.1",
      "N:Souza;Bruno;;;",
      "TEL;HOME:(21) 3456-7890",
      "TEL;CELL:(21) 99876-",
      " 5432",
      "END:VCARD",
      "BEGIN:VCARD",
      "FN:Carla Fixo",
      "TEL:(31) 3333-4444",
      "END:VCARD",
    ].join("\r\n");
    const contacts = parseVcard(vcf);
    expect(contacts).toEqual([
      { name: "Ana Lima", numbers: ["+55 11 98765-4321"] },
      { name: "Bruno Souza", numbers: ["(21) 3456-7890", "(21) 99876-5432"] },
      { name: "Carla Fixo", numbers: ["(31) 3333-4444"] },
    ]);
    expect(contactsToLines(contacts)).toEqual({ lines: ["Ana Lima; (11) 98765-4321", "Bruno Souza; (21) 99876-5432"], skipped: ["Carla Fixo"] });
  });
});
