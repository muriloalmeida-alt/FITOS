"use client";

import { useId, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ActionRow, Button, ChipGroup, FormAlert, Sheet, TextField, useToast } from "@/shared/ui";
import { NavIcon } from "@/shared/ui/NavIcon";
import { requestJson } from "../_workout-builder/apiClient";
import { AvatarPicker } from "../_photos/AvatarPicker";
import styles from "./ProfileParts.module.css";

/// Peças do Perfil remodelado (proposta 10, aprovada em 11/10/2026):
/// identidade no topo, grupos de linhas compactas (ícone, título, resumo,
/// ›) com a linha inteira clicável e os detalhes em modais inferiores.

export type ProfileIconName = "treino" | "dias" | "lembrete" | "dados" | "assinatura" | "biometria" | "termos" | "personal" | "saude" | "financeiro" | "exercicios" | "config";

function Glyph({ name }: { name: ProfileIconName }) {
  switch (name) {
    case "dias":
      return (
        <>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M16 3v4M8 3v4M3 10h18" />
        </>
      );
    case "lembrete":
      return (
        <>
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </>
      );
    case "dados":
      return (
        <>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
        </>
      );
    case "biometria":
      return (
        <>
          <path d="M12 11v3a8 8 0 0 1-2 5" />
          <path d="M8 11a4 4 0 0 1 8 0v2a12 12 0 0 1-1 5" />
          <path d="M5 13v-2a7 7 0 0 1 12-5" />
          <path d="M19 10.5V13a15 15 0 0 1-.5 4" />
        </>
      );
    case "termos":
      return (
        <>
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
          <path d="M14 3v5h5M9 13h6M9 17h6" />
        </>
      );
    case "personal":
      return (
        <>
          <circle cx="9" cy="8" r="3.5" />
          <path d="M2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5" />
          <path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5c2 .6 3.5 2.4 3.5 5.5" />
        </>
      );
    case "saude":
      return <path d="M20.8 5.6a5 5 0 0 0-7.6-.6L12 6.2l-1.2-1.2a5 5 0 0 0-7.1 7.1L12 20.5l8.3-8.4a5 5 0 0 0 .5-6.5z" />;
    default:
      return null;
  }
}

const NAV_ICON: Partial<Record<ProfileIconName, Parameters<typeof NavIcon>[0]["name"]>> = { treino: "treinos", assinatura: "assinatura", financeiro: "financeiro", exercicios: "exercicios", config: "config" };

export function ProfileIcon({ name }: { name: ProfileIconName }) {
  const nav = NAV_ICON[name];
  return (
    <span className={styles.icon} aria-hidden="true">
      {nav ? (
        <NavIcon name={nav} />
      ) : (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <Glyph name={name} />
        </svg>
      )}
    </span>
  );
}

/// Identidade: foto editável (as iniciais só aparecem sem foto), nome,
/// e-mail e o produto ou vínculo da conta.
export function ProfileHeader({ name, image, email, badge }: { name: string; image: string | null; email: string; badge: string }) {
  return (
    <div className={styles.identity}>
      <AvatarPicker name={name} image={image} />
      <div className={styles.identityText}>
        <p className={styles.name}>{name}</p>
        <p className={styles.email}>{email}</p>
        <p className={styles.badge}>{badge}</p>
      </div>
    </div>
  );
}

export function ProfileGroup({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className={styles.cap}>
        {title}
      </h2>
      <ul className={styles.list}>{children}</ul>
    </section>
  );
}

const chevron = <span className={styles.chevron} aria-hidden="true">›</span>;

/// Linha compacta: a linha inteira é o alvo (link ou botão).
export function ProfileRow({ icon, title, summary, href, onClick }: { icon: ProfileIconName; title: string; summary?: ReactNode; href?: string; onClick?: () => void }) {
  return (
    <li>
      <ActionRow leading={<ProfileIcon name={icon} />} title={title} description={summary} href={href} onClick={onClick} trailing={chevron} />
    </li>
  );
}

/// Termos e privacidade: uma linha, duas opções na modal.
export function TermsRow() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <ProfileRow icon="termos" title="Termos e privacidade" onClick={() => setOpen(true)} />
      <Sheet open={open} onClose={() => setOpen(false)} title="Termos e privacidade" closable>
        <ul className={styles.list}>
          <li>
            <ActionRow href="/termos-de-uso" title="Termos de uso" trailing={chevron} />
          </li>
          <li>
            <ActionRow href="/politica-de-privacidade" title="Política de privacidade" trailing={chevron} />
          </li>
        </ul>
      </Sheet>
    </>
  );
}

/// Detalhe aberto sob demanda: linha que abre uma modal com título e ×.
export function SheetRow({ icon, title, summary, sheetTitle, footer, children }: { icon: ProfileIconName; title: string; summary?: ReactNode; sheetTitle?: string; footer?: (close: () => void) => ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <>
      <ProfileRow icon={icon} title={title} summary={summary} onClick={() => setOpen(true)} />
      <Sheet open={open} onClose={close} title={sheetTitle ?? title} closable footer={footer?.(close)}>
        {children}
      </Sheet>
    </>
  );
}

export interface DataInput {
  name: string;
  label: string;
  type?: "text" | "email" | "password" | "tel";
  autoComplete?: string;
  maxLength?: number;
  /// Campo que pode ficar vazio.
  optional?: boolean;
  /// Máscara aplicada a cada tecla (ex.: celular).
  format?: (value: string) => string;
  /// Com opções, vira um grupo de chips.
  options?: { value: string; label: string }[];
}

export interface DataField {
  key: string;
  title: string;
  value: string;
  /// Texto de apoio no formulário (ex.: "Joana também vê este nome.").
  hint?: string;
  inputs: DataInput[];
  initial: Record<string, string>;
  save: (values: Record<string, string>) => Promise<unknown>;
  message: string;
}

/// "Meus dados": a modal lista só os campos permitidos para o perfil; cada
/// item abre o mesmo formulário de antes, com Salvar e Cancelar (Cancelar
/// volta à lista). Erro mantém os valores digitados.
export function MyDataRow({ summary, fields }: { summary: string; fields: DataField[] }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DataField | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setOpen(false);
    setEditing(null);
  }

  function edit(field: DataField) {
    setDraft({ ...field.initial });
    setError(null);
    setEditing(field);
  }

  async function save() {
    if (!editing) return;
    setBusy(true);
    setError(null);
    try {
      await editing.save(draft);
      toast.show(editing.message);
      setEditing(null);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }

  const incomplete = editing ? editing.inputs.some((input) => !input.optional && (draft[input.name] ?? "").trim().length === 0) : false;

  return (
    <>
      <ProfileRow icon="dados" title="Meus dados" summary={summary} onClick={() => setOpen(true)} />
      <Sheet
        open={open}
        onClose={close}
        title={editing ? editing.title : "Meus dados"}
        closable
        footer={
          editing ? (
            <>
              <Button type="button" block disabled={busy || incomplete} onClick={() => void save()}>
                Salvar
              </Button>
              <Button type="button" variant="quiet" block onClick={() => setEditing(null)}>
                Cancelar
              </Button>
            </>
          ) : undefined
        }
      >
        {editing ? (
          <div className={styles.form}>
            {editing.inputs.map((input) =>
              input.options ? (
                <ChipGroup key={input.name} label={input.label} showLabel tone="accent" value={draft[input.name] ?? ""} onChange={(value) => setDraft((current) => ({ ...current, [input.name]: value }))} options={input.options} />
              ) : (
                <TextField
                  key={input.name}
                  label={input.label}
                  type={input.type === "tel" ? "text" : (input.type ?? "text")}
                  inputMode={input.type === "tel" ? "tel" : input.type === "email" ? "email" : undefined}
                  autoComplete={input.autoComplete}
                  maxLength={input.maxLength}
                  value={draft[input.name] ?? ""}
                  onChange={(event) => {
                    const value = input.format ? input.format(event.target.value) : event.target.value;
                    setDraft((current) => ({ ...current, [input.name]: value }));
                  }}
                />
              )
            )}
            {editing.hint ? <p className={styles.hint}>{editing.hint}</p> : null}
            {error ? <FormAlert>{error}</FormAlert> : null}
          </div>
        ) : (
          <ul className={styles.list}>
            {fields.map((field) => (
              <li key={field.key}>
                <ActionRow title={field.title} description={field.value} onClick={() => edit(field)} trailing={chevron} />
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    </>
  );
}

/// PATCH/POST em JSON pelo cliente de sempre (mensagens de erro do servidor).
export function sendJson(url: string, method: "PATCH" | "POST", body: unknown) {
  return requestJson(url, { method, body: JSON.stringify(body) });
}
