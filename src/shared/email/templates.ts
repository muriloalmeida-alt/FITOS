import type { Email } from "./send";

/// Modelos dos e-mails do FitOS: HTML simples (lido bem em qualquer
/// cliente de e-mail) e a versão em texto.

const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

function layout(title: string, paragraphs: string[], action: { label: string; url: string }, footer: string): string {
  const body = paragraphs.map((text) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:#1f2430">${escape(text)}</p>`).join("");
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:24px;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif">
<div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px">
<p style="margin:0 0 24px;font-size:22px;font-weight:bold;color:#101c2c">Fit<span style="color:#cc3600">OS</span></p>
<h1 style="margin:0 0 16px;font-size:20px;color:#101c2c">${escape(title)}</h1>
${body}
<p style="margin:24px 0"><a href="${escape(action.url)}" style="display:inline-block;background:#cc3600;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:8px">${escape(action.label)}</a></p>
<p style="margin:0;font-size:13px;line-height:1.5;color:#6b7280">${escape(footer)}</p>
</div></body></html>`;
}

export function passwordResetEmail(input: { to: string; name: string; url: string; minutes: number }): Email {
  const first = input.name.trim().split(/\s+/)[0] || "Olá";
  const lines = [`Oi, ${first}!`, "Recebemos um pedido para criar uma nova senha para a sua conta do FitOS. Toque no botão abaixo para escolher a nova senha."];
  const footer = `O link vale por ${input.minutes} minutos e só pode ser usado uma vez. Se não foi você quem pediu, ignore este e-mail: sua senha continua a mesma.`;
  return {
    to: input.to,
    subject: "Crie uma nova senha no FitOS",
    html: layout("Nova senha", lines, { label: "Criar nova senha", url: input.url }, footer),
    text: `${lines.join("\n\n")}\n\n${input.url}\n\n${footer}`,
  };
}
