/// CRM de convites (admin): regras puras de celular, importação em lote,
/// mensagem padrão e link do WhatsApp (wa.me). Sem dependência de servidor.

export const CRM_MAX_BATCH = 200;

/// Celular brasileiro em dígitos com DDI: "(11) 98765-4321", "+55 11
/// 98765 4321" e "11987654321" viram "5511987654321". Só celular (DDD + 9
/// dígitos começando por 9); `null` quando não é um.
export function normalizeBrazilianMobile(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("55")) digits = digits.slice(2);
  if (digits.length !== 11) return null;
  const ddd = Number(digits.slice(0, 2));
  if (ddd < 11 || ddd > 99 || digits[2] !== "9") return null;
  return `55${digits}`;
}

/// "5511987654321" → "(11) 98765-4321".
export function formatMobile(phone: string): string {
  const local = phone.startsWith("55") ? phone.slice(2) : phone;
  return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ProspectInput {
  name: string;
  phone: string;
  email: string | null;
  note: string | null;
}

export class CrmInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CrmInputError";
  }
}

/// Valida um contato (cadastro individual ou uma linha do lote).
export function parseProspect(raw: { name?: unknown; phone?: unknown; email?: unknown; note?: unknown }): ProspectInput {
  const name = typeof raw.name === "string" ? raw.name.trim().replace(/\s+/g, " ").slice(0, 80) : "";
  if (name.length < 2) throw new CrmInputError("Informe o nome.");
  const phone = normalizeBrazilianMobile(raw.phone);
  if (!phone) throw new CrmInputError("Celular inválido: use DDD + número, ex.: (11) 98765-4321.");
  const email = typeof raw.email === "string" && raw.email.trim() ? raw.email.trim().toLowerCase() : null;
  if (email && !EMAIL.test(email)) throw new CrmInputError("E-mail inválido.");
  const note = typeof raw.note === "string" && raw.note.trim() ? raw.note.trim().slice(0, 300) : null;
  return { name, phone, email, note };
}

export interface BulkParse {
  valid: (ProspectInput & { line: number })[];
  errors: { line: number; text: string; message: string }[];
}

/// Lista colada ou CSV: uma pessoa por linha, "Nome; celular; e-mail"
/// (separador ; , ou tab; e-mail opcional). Cabeçalho "nome" é ignorado.
/// Celular repetido na própria lista conta uma vez.
export function parseBulk(text: string): BulkParse {
  const result: BulkParse = { valid: [], errors: [] };
  const seen = new Set<string>();
  const lines = text.split(/\r?\n/);
  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) return;
    const parts = line.split(/[;\t]|,(?=\s*[+(\d])/).map((part) => part.trim().replace(/^"|"$/g, ""));
    if (index === 0 && /^nome$/i.test(parts[0] ?? "")) return;
    try {
      const prospect = parseProspect({ name: parts[0], phone: parts[1], email: parts[2] });
      if (seen.has(prospect.phone)) throw new CrmInputError("Celular repetido na lista.");
      seen.add(prospect.phone);
      result.valid.push({ ...prospect, line: index + 1 });
    } catch (error) {
      result.errors.push({ line: index + 1, text: line.slice(0, 80), message: error instanceof Error ? error.message : "Linha inválida." });
    }
  });
  if (result.valid.length > CRM_MAX_BATCH) throw new CrmInputError(`No máximo ${CRM_MAX_BATCH} contatos por importação.`);
  return result;
}

/// Mensagem padrão do convite ("Conheça o FitOS").
export function inviteMessage(input: { name: string; couponCode: string; link: string }): string {
  const first = input.name.trim().split(/\s+/)[0] ?? input.name;
  return [
    `Olá, ${first}! Conheça o FitOS: seu treino organizado no celular, com plano pronto em poucos toques.`,
    `Você ganha 30 dias grátis e, depois, 50% de desconto nos 30 dias seguintes com o cupom ${input.couponCode}, que já vem aplicado quando você entra por este link:`,
    input.link,
  ].join("\n\n");
}

/// Abre o WhatsApp na conversa com o contato e a mensagem pronta.
export function whatsappLink(phone: string, message: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
