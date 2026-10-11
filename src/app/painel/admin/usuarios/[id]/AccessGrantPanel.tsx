"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ChipGroup, FormAlert, Tag, TextField } from "@/shared/ui";
import { GRANT_DAY_OPTIONS, GRANT_MAX_DAYS, GRANT_REASONS, validateGrantInput, type GrantReason } from "@/modules/billing/grantRules";
import styles from "../../admin.module.css";

export type GrantStatus = "AGENDADO" | "EM_VIGOR" | "ENCERRADO" | "REVOGADO" | "SINCRONIZANDO" | "FALHOU";

export interface GrantRow {
  id: string;
  days: number;
  startsAt: string;
  lastDay: string;
  status: GrantStatus;
  reasonCode: string;
  reasonText: string | null;
  revokeReason: string | null;
  /// Próxima cobrança no Asaas adiada para (AAAA-MM-DD).
  targetDueDate?: string | null;
  syncError?: string | null;
}

/// Situação atual vinda da prévia do servidor (ou o motivo de não poder).
export type GrantCurrent = { eligible: false; message: string } | { eligible: true; audience: string; planName: string; access: "LIBERADO" | "CARENCIA" | "BLOQUEADO"; freeUntil: string | null };

interface Preview {
  startsAt: string;
  endsAt: string;
  lastDay: string;
  billing: string;
  access: "LIBERADO" | "CARENCIA" | "BLOQUEADO";
  freeUntil: string | null;
  revision: string;
}

const STATUS: Record<GrantStatus, { label: string; tone: "accent" | "ok" | "muted" | "error" }> = {
  AGENDADO: { label: "Agendado", tone: "accent" },
  EM_VIGOR: { label: "Em vigor", tone: "ok" },
  ENCERRADO: { label: "Encerrado", tone: "muted" },
  REVOGADO: { label: "Revogado", tone: "muted" },
  SINCRONIZANDO: { label: "Processando", tone: "accent" },
  FALHOU: { label: "Falhou", tone: "error" },
};
const ACCESS = { LIBERADO: "liberado", CARENCIA: "em carência", BLOQUEADO: "bloqueado" } as const;

type DayChoice = `${(typeof GRANT_DAY_OPTIONS)[number]}` | "outro";
const DAY_CHOICES = [...GRANT_DAY_OPTIONS.map((days) => ({ value: `${days}` as DayChoice, label: `+${days} dias` })), { value: "outro" as DayChoice, label: "Personalizado" }];
const REASON_CHOICES = (Object.keys(GRANT_REASONS) as GrantReason[]).map((value) => ({ value, label: GRANT_REASONS[value] }));

const dayFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" });
const instantFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
/// "AAAA-MM-DD" (dia local) → "DD/MM/AAAA".
const localDay = (day: string) => day.split("-").reverse().join("/");

async function errorMessage(response: Response, fallback: string) {
  const body = await response.json().catch(() => null);
  return typeof body?.message === "string" ? body.message : fallback;
}

/// Renovação de gratuidade (feature 4): escolher dias e motivo, revisar o
/// impacto e confirmar; depois, histórico com revogação. Cada revisão
/// gera uma chave nova, então repetir o envio não soma dias.
export function AccessGrantPanel({ userId, current, history }: { userId: string; current: GrantCurrent; history: GrantRow[] }) {
  const router = useRouter();
  const [choice, setChoice] = useState<DayChoice>("30");
  const [customDays, setCustomDays] = useState("");
  const [reason, setReason] = useState<GrantReason | null>(null);
  const [reasonText, setReasonText] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [preview, setPreview] = useState<(Preview & { operationKey: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const days = choice === "outro" ? Number(customDays) : Number(choice);

  async function review() {
    const error = validateGrantInput({ days, reasonCode: reason, reasonText });
    if (error) {
      setFormError(error);
      return;
    }
    setFormError(null);
    setReceipt(null);
    setBusy(true);
    const response = await fetch(`/api/admin/usuarios/${userId}/gratuidade/previa`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ days }) });
    setBusy(false);
    if (!response.ok) {
      setFormError(await errorMessage(response, "Não foi possível calcular a prévia."));
      return;
    }
    const body = await response.json();
    if (!body.eligible) {
      setFormError(body.message);
      return;
    }
    setPreview({ ...body, operationKey: crypto.randomUUID() });
  }

  async function confirm() {
    if (!preview || busy) return;
    setBusy(true);
    setFormError(null);
    const response = await fetch(`/api/admin/usuarios/${userId}/gratuidade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days, reasonCode: reason, reasonText, operationKey: preview.operationKey, revision: preview.revision }),
    });
    setBusy(false);
    if (!response.ok) {
      setFormError(await errorMessage(response, "Não foi possível conceder. Tente de novo."));
      if (response.status === 409) setPreview(null);
      return;
    }
    const { grant } = await response.json();
    setPreview(null);
    setReasonText("");
    setReason(null);
    setReceipt(`Gratuidade concedida: ${grant.days} dias, acesso gratuito até ${localDay(grant.lastDay)}.`);
    router.refresh();
  }

  async function revoke(grantId: string) {
    if (!revokeReason.trim()) {
      setRevokeError("Descreva o motivo da revogação.");
      return;
    }
    setBusy(true);
    const response = await fetch(`/api/admin/gratuidade/${grantId}/revogar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: revokeReason }) });
    setBusy(false);
    if (!response.ok) {
      setRevokeError(await errorMessage(response, "Não foi possível revogar."));
      return;
    }
    setRevoking(null);
    setRevokeReason("");
    setRevokeError(null);
    router.refresh();
  }

  return (
    <section className={styles.section} aria-labelledby="beneficios">
      <h2 id="beneficios">Benefícios</h2>
      {current.eligible ? (
        <p className={styles.muted}>
          {current.planName === current.audience ? current.planName : `${current.audience} · ${current.planName}`} · acesso {ACCESS[current.access]}
          {current.freeUntil ? ` · gratuito até ${instantFmt.format(new Date(current.freeUntil))}` : ""}
        </p>
      ) : (
        <FormAlert variant="info">{current.message}</FormAlert>
      )}
      {receipt ? <FormAlert variant="info">{receipt}</FormAlert> : null}

      {current.eligible && !preview ? (
        <>
          <h3 className={styles.subhead}>Renovar gratuidade</h3>
          <ChipGroup<DayChoice> label="Dias de gratuidade" showLabel options={DAY_CHOICES} value={choice} onChange={setChoice} />
          {choice === "outro" ? (
            <TextField label={`Dias (1 a ${GRANT_MAX_DAYS})`} name="customDays" type="number" inputMode="numeric" min={1} max={GRANT_MAX_DAYS} value={customDays} onChange={(event) => setCustomDays(event.target.value)} />
          ) : null}
          <ChipGroup<GrantReason> label="Motivo" showLabel options={REASON_CHOICES} value={reason} onChange={setReason} />
          <TextField label={reason === "OUTRO" ? "Descreva o motivo" : "Detalhe (opcional)"} name="reasonText" maxLength={300} value={reasonText} onChange={(event) => setReasonText(event.target.value)} />
          {formError ? <FormAlert variant="error">{formError}</FormAlert> : null}
          <Button type="button" size="lg" block onClick={review} disabled={busy}>
            {busy ? "Calculando…" : "Revisar"}
          </Button>
        </>
      ) : null}

      {preview ? (
        <div className={styles.review} aria-label="Revisão da gratuidade">
          <h3 className={styles.subhead}>Revise antes de confirmar</h3>
          <dl className={styles.reviewList}>
            <div>
              <dt>Dias</dt>
              <dd>+{days} dias</dd>
            </div>
            <div>
              <dt>Começa</dt>
              <dd>{instantFmt.format(new Date(preview.startsAt))}</dd>
            </div>
            <div>
              <dt>Acesso gratuito até</dt>
              <dd>{localDay(preview.lastDay)} (último dia incluído)</dd>
            </div>
            <div>
              <dt>Situação hoje</dt>
              <dd>
                Acesso {ACCESS[preview.access]}
                {preview.freeUntil ? `, gratuito até ${instantFmt.format(new Date(preview.freeUntil))}` : ""}
              </dd>
            </div>
            <div>
              <dt>Cobrança</dt>
              <dd>{preview.billing}</dd>
            </div>
            <div>
              <dt>Motivo</dt>
              <dd>{[reason ? GRANT_REASONS[reason] : "", reasonText.trim()].filter(Boolean).join(": ")}</dd>
            </div>
          </dl>
          <p className={styles.muted}>Não quita dívidas anteriores nem estorna valores. O teste grátis original continua registrado.</p>
          {formError ? <FormAlert variant="error">{formError}</FormAlert> : null}
          <Button type="button" size="lg" block onClick={confirm} disabled={busy}>
            {busy ? "Concedendo…" : "Confirmar gratuidade"}
          </Button>
          <Button type="button" variant="quiet" block onClick={() => setPreview(null)} disabled={busy}>
            Voltar
          </Button>
        </div>
      ) : null}

      <h3 className={styles.subhead}>Histórico</h3>
      {history.length === 0 ? (
        <p className={styles.muted}>Nenhuma gratuidade concedida.</p>
      ) : (
        <ul className={styles.grants}>
          {history.map((grant) => (
            <li key={grant.id}>
              <div className={styles.grantTop}>
                <span>
                  {dayFmt.format(new Date(grant.startsAt))} a {localDay(grant.lastDay)} · {grant.days} dias
                </span>
                <Tag tone={STATUS[grant.status].tone}>{STATUS[grant.status].label}</Tag>
              </div>
              <span className={styles.muted}>
                {GRANT_REASONS[grant.reasonCode as GrantReason] ?? grant.reasonCode}
                {grant.reasonText ? `: ${grant.reasonText}` : ""}
                {grant.revokeReason ? ` · revogado: ${grant.revokeReason}` : ""}
              </span>
              {grant.targetDueDate ? <span className={styles.muted}>Asaas: próxima cobrança em {localDay(grant.targetDueDate)}{grant.status === "REVOGADO" ? " (não volta sozinha: ajuste no Asaas se precisar)" : ""}</span> : null}
              {grant.status === "SINCRONIZANDO" ? <span className={styles.muted}>Aplicando no Asaas. O acesso muda quando o Asaas confirmar.</span> : null}
              {grant.status === "FALHOU" ? <span className={styles.muted}>Não aplicado no Asaas{grant.syncError ? ` (${grant.syncError})` : ""}. Confira a próxima cobrança no Asaas antes de conceder de novo.</span> : null}
              {grant.status === "AGENDADO" || grant.status === "EM_VIGOR" ? (
                revoking === grant.id ? (
                  <div className={styles.revoke}>
                    <TextField label="Motivo da revogação" name="revokeReason" maxLength={300} value={revokeReason} onChange={(event) => setRevokeReason(event.target.value)} error={revokeError ?? undefined} />
                    <Button type="button" variant="danger" onClick={() => revoke(grant.id)} disabled={busy}>
                      Revogar gratuidade
                    </Button>
                    <Button type="button" variant="quiet" onClick={() => setRevoking(null)} disabled={busy}>
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="quiet"
                    onClick={() => {
                      setRevoking(grant.id);
                      setRevokeReason("");
                      setRevokeError(null);
                    }}
                  >
                    Revogar
                  </Button>
                )
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
