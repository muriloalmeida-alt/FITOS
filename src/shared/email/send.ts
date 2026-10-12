import "server-only";
import { describeError, logEvent } from "@/shared/lib/serverLog";

/// Envio de e-mail transacional pelo Resend (API HTTP, sem SDK).
/// `RESEND_API_KEY` liga o envio; `EMAIL_FROM` é o remetente (de um
/// domínio verificado no Resend). Sem a chave, nada sai: o envio só fica
/// registrado no log, sem o conteúdo (links de senha nunca vão para o log).

export interface Email {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export const DEFAULT_EMAIL_FROM = "FitOS <nao-responda@fitos.app>";
const RESEND_URL = "https://api.resend.com/emails";
const TIMEOUT_MS = 10_000;

export function emailConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.RESEND_API_KEY?.trim());
}

export async function sendEmail(email: Email, deps: { fetchImpl?: typeof fetch; env?: Record<string, string | undefined> } = {}): Promise<boolean> {
  const env = deps.env ?? process.env;
  const apiKey = env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    logEvent("warn", "email_nao_configurado", { subject: email.subject });
    return false;
  }
  try {
    const response = await (deps.fetchImpl ?? fetch)(RESEND_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM?.trim() || DEFAULT_EMAIL_FROM, to: [email.to], subject: email.subject, html: email.html, text: email.text }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      logEvent("error", "email_recusado", { status: response.status, subject: email.subject, detail: detail.slice(0, 300) });
      return false;
    }
    logEvent("info", "email_enviado", { subject: email.subject });
    return true;
  } catch (error) {
    logEvent("error", "email_falhou", { subject: email.subject, ...describeError(error) });
    return false;
  }
}
