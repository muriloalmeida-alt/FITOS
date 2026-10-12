"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import type { CrmProspectStatus } from "@prisma/client";
import { ActionRow, Button, FormAlert, Sheet, Tag, TextField, useToast } from "@/shared/ui";
import { requestJson } from "../../_workout-builder/apiClient";
import { contactsToLines, parseVcard } from "@/shared/lib/crm";
import { STATUS_LABEL, STATUS_TONE } from "./crmLabels";
import styles from "./crm.module.css";

export interface CrmRow {
  id: string;
  name: string;
  phoneLabel: string;
  email: string | null;
  note: string | null;
  status: CrmProspectStatus;
  couponCode: string;
  inviteCount: number;
  message: string;
  whatsappUrl: string;
  timeline: string[];
}

interface BulkResult {
  created: number;
  duplicates: { line: number; name: string }[];
  errors: { line: number; text: string; message: string }[];
}

/// Contact Picker API (Chrome no Android): a agenda do celular, com a
/// permissão da pessoa a cada uso. O iPhone não oferece; lá vale o .vcf.
type ContactsManager = { select: (properties: string[], options: { multiple: boolean }) => Promise<{ name?: string[]; tel?: string[] }[]> };
function contactsManager(): ContactsManager | null {
  if (typeof navigator === "undefined") return null;
  const manager = (navigator as Navigator & { contacts?: ContactsManager }).contacts;
  return manager && typeof manager.select === "function" ? manager : null;
}

/// Conta o envio sem atrasar a abertura do WhatsApp (o link abre na hora).
function markSent(id: string) {
  void fetch(`/api/admin/crm/${id}/enviado`, { method: "POST", keepalive: true }).catch(() => undefined);
}

/// CRM de convites: cadastro individual ou em lote, fila de envio (um toque
/// por contato abre o WhatsApp com a mensagem pronta) e acompanhamento.
export function CrmView({ rows, queue }: { rows: CrmRow[]; queue: CrmRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [sheet, setSheet] = useState<null | "novo" | "lote">(null);
  const [preview, setPreview] = useState<CrmRow | null>(null);
  const [discard, setDiscard] = useState<CrmRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "", note: "" });
  const [text, setText] = useState("");
  const [result, setResult] = useState<BulkResult | null>(null);
  const [picker, setPicker] = useState(false);
  const [agendaNote, setAgendaNote] = useState<string | null>(null);

  // Só no cliente: o servidor não sabe se o aparelho tem a agenda.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- capacidade do aparelho, lida uma vez depois da hidratação
    setPicker(contactsManager() !== null);
  }, []);

  function addContacts(contacts: { name: string; numbers: string[] }[]) {
    const { lines, skipped } = contactsToLines(contacts);
    if (lines.length > 0) setText((current) => [current.trim(), ...lines].filter(Boolean).join("\n"));
    setAgendaNote(
      [
        lines.length > 0 ? `${lines.length} ${lines.length === 1 ? "contato entrou" : "contatos entraram"} na lista.` : "Nenhum contato com celular válido.",
        skipped.length > 0 ? `Sem celular válido: ${skipped.slice(0, 5).join(", ")}${skipped.length > 5 ? ` e mais ${skipped.length - 5}` : ""}.` : null,
      ]
        .filter(Boolean)
        .join(" ")
    );
  }

  async function pickFromAgenda() {
    const manager = contactsManager();
    if (!manager) return;
    setError(null);
    try {
      const picked = await manager.select(["name", "tel"], { multiple: true });
      addContacts(picked.map((contact) => ({ name: contact.name?.[0] ?? "", numbers: contact.tel ?? [] })));
    } catch {
      // Cancelou ou negou a permissão: nada muda.
    }
  }

  function open(kind: "novo" | "lote") {
    setError(null);
    setResult(null);
    setAgendaNote(null);
    setSheet(kind);
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }

  function sent(row: CrmRow) {
    markSent(row.id);
    // Deixa o WhatsApp abrir antes de atualizar a fila.
    window.setTimeout(() => router.refresh(), 800);
  }

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    // Contatos exportados da agenda (.vcf) ou planilha (.csv).
    if (/\.vcf$/i.test(file.name) || /BEGIN:VCARD/i.test(content)) addContacts(parseVcard(content));
    else setText(content);
  }

  const next = queue[0] ?? null;

  return (
    <div className={styles.view}>
      <div className={styles.actions}>
        <Button type="button" onClick={() => open("novo")}>
          Adicionar contato
        </Button>
        <Button type="button" variant="secondary" onClick={() => open("lote")}>
          Importar lista ou agenda
        </Button>
      </div>

      {next ? (
        <section className={styles.queue} aria-label="Fila de envio">
          <p className={styles.queueTitle}>
            Fila de envio · {queue.length} {queue.length === 1 ? "contato novo" : "contatos novos"}
          </p>
          <p className={styles.muted}>Cada toque abre o WhatsApp com a mensagem pronta; confirme o envio lá. A fila anda sozinha.</p>
          <Button href={next.whatsappUrl} target="_blank" rel="noreferrer" block onClick={() => sent(next)}>
            Enviar para {next.name}
          </Button>
        </section>
      ) : null}

      {rows.length === 0 ? (
        <p className={styles.muted}>Nenhum contato aqui. Adicione um contato ou importe uma lista.</p>
      ) : (
        <ul className={styles.list} aria-label="Contatos">
          {rows.map((row) => (
            <li key={row.id} className={styles.item}>
              <ActionRow
                title={
                  <>
                    {row.name} <Tag tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Tag>
                  </>
                }
                description={[row.phoneLabel, `cupom ${row.couponCode}`, ...row.timeline].join(" · ")}
              />
              <div className={styles.rowActions}>
                {row.status === "DESCARTADO" || row.status === "CADASTRADO" ? null : (
                  <a className={styles.link} href={row.whatsappUrl} target="_blank" rel="noreferrer" onClick={() => sent(row)}>
                    {row.inviteCount > 0 ? "Reenviar no WhatsApp" : "Enviar no WhatsApp"}
                  </a>
                )}
                <button type="button" className={styles.link} onClick={() => setPreview(row)}>
                  Ver mensagem
                </button>
                {row.status === "DESCARTADO" || row.status === "CADASTRADO" ? null : (
                  <button type="button" className={styles.linkMuted} onClick={() => { setError(null); setDiscard(row); }}>
                    Descartar
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Sheet
        open={sheet === "novo"}
        onClose={() => setSheet(null)}
        title="Adicionar contato"
        description="Futuro cliente do FitOS Livre. O cupom de 50% no primeiro mês é criado na hora, só para ele."
        footer={
          <>
            <Button
              type="button"
              block
              disabled={busy || form.name.trim().length < 2 || form.phone.replace(/\D/g, "").length < 10}
              onClick={() =>
                void run(async () => {
                  await requestJson("/api/admin/crm", { method: "POST", body: JSON.stringify(form) });
                  toast.show("Contato adicionado");
                  setForm({ name: "", phone: "", email: "", note: "" });
                  setSheet(null);
                  router.refresh();
                })
              }
            >
              {busy ? "Salvando…" : "Adicionar"}
            </Button>
            <Button type="button" variant="quiet" block onClick={() => setSheet(null)}>
              Cancelar
            </Button>
          </>
        }
      >
        <div className={styles.form}>
          <TextField label="Nome" value={form.name} maxLength={80} autoComplete="off" onChange={(event) => setForm({ ...form, name: event.target.value })} />
          <TextField label="Celular (WhatsApp)" inputMode="tel" placeholder="(11) 98765-4321" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
          <TextField label="E-mail (opcional)" type="email" inputMode="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          <TextField label="Observação (opcional)" value={form.note} maxLength={300} onChange={(event) => setForm({ ...form, note: event.target.value })} />
          {error ? <FormAlert>{error}</FormAlert> : null}
        </div>
      </Sheet>

      <Sheet
        open={sheet === "lote"}
        onClose={() => setSheet(null)}
        title="Importar lista"
        description="Da agenda do celular, de um arquivo de contatos (.vcf) ou de uma lista: Nome; celular; e-mail (opcional). Até 200 por vez; revise antes de importar."
        footer={
          result ? (
            <Button type="button" block onClick={() => setSheet(null)}>
              Concluir
            </Button>
          ) : (
            <>
              <Button
                type="button"
                block
                disabled={busy || !text.trim()}
                onClick={() =>
                  void run(async () => {
                    const response = (await requestJson("/api/admin/crm/lote", { method: "POST", body: JSON.stringify({ text }) })) as BulkResult;
                    setResult(response);
                    if (response.created > 0) {
                      setText("");
                      router.refresh();
                    }
                  })
                }
              >
                {busy ? "Importando…" : "Importar"}
              </Button>
              <Button type="button" variant="quiet" block onClick={() => setSheet(null)}>
                Cancelar
              </Button>
            </>
          )
        }
      >
        {result ? (
          <div className={styles.form} role="status">
            <p className={styles.resultTitle}>
              {result.created} {result.created === 1 ? "contato adicionado" : "contatos adicionados"}, cada um com o próprio cupom.
            </p>
            {result.duplicates.length > 0 ? (
              <p className={styles.muted}>Já estavam no CRM (linhas {result.duplicates.map((entry) => entry.line).join(", ")}): {result.duplicates.map((entry) => entry.name).join(", ")}.</p>
            ) : null}
            {result.errors.length > 0 ? (
              <ul className={styles.errors} aria-label="Linhas com problema">
                {result.errors.map((entry) => (
                  <li key={entry.line}>
                    Linha {entry.line} ({entry.text}): {entry.message}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <div className={styles.form}>
            {picker ? (
              <Button type="button" variant="secondary" block onClick={() => void pickFromAgenda()}>
                Escolher da agenda do celular
              </Button>
            ) : (
              <p className={styles.muted}>
                No iPhone: abra Contatos, selecione as pessoas (ou uma lista), toque em Compartilhar e salve o arquivo .vcf; depois escolha o arquivo aqui. No Android com Chrome, o botão da agenda aparece aqui.
              </p>
            )}
            {agendaNote ? (
              <p className={styles.muted} role="status">
                {agendaNote}
              </p>
            ) : null}
            <label className={styles.textareaLabel}>
              Lista
              <textarea className={styles.textarea} rows={8} value={text} placeholder={"Ana Lima; (11) 98765-4321; ana@email.com\nBruno Souza; 21 99876-5432"} onChange={(event) => setText(event.target.value)} />
            </label>
            <label className={styles.file}>
              Ou escolha um arquivo de contatos (.vcf) ou lista (.csv)
              <input type="file" accept=".vcf,.csv,.txt,text/vcard,text/x-vcard,text/csv,text/plain" onChange={(event) => void onFile(event)} />
            </label>
            {error ? <FormAlert>{error}</FormAlert> : null}
          </div>
        )}
      </Sheet>

      <Sheet open={preview !== null} onClose={() => setPreview(null)} title="Mensagem do convite" closable>
        {preview ? <p className={styles.message}>{preview.message}</p> : null}
      </Sheet>

      <Sheet
        open={discard !== null}
        onClose={() => setDiscard(null)}
        title={`Descartar ${discard?.name ?? ""}?`}
        description="O cupom dele é encerrado e o link do convite deixa de valer."
        footer={
          <>
            <Button
              type="button"
              block
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await requestJson(`/api/admin/crm/${discard!.id}/descartar`, { method: "POST" });
                  toast.show("Contato descartado");
                  setDiscard(null);
                  router.refresh();
                })
              }
            >
              Descartar
            </Button>
            <Button type="button" variant="quiet" block onClick={() => setDiscard(null)}>
              Cancelar
            </Button>
          </>
        }
      >
        {error ? <FormAlert>{error}</FormAlert> : null}
      </Sheet>
    </div>
  );
}
