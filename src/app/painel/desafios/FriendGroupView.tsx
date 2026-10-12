"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, Button, ChipGroup, FormAlert, Sheet } from "@/shared/ui";
import { formatPoints } from "@/shared/lib/scoring";
import { MODE_HELP, MODE_LABEL, seasonLabel } from "./friendTexts";
import ranking from "./ClassRankingPanel.module.css";
import styles from "./FriendGroups.module.css";
import { ContestSheet, type WorkoutForContest } from "./ContestSheet";
import { ReviewQueue, type ReviewCaseView } from "./ReviewQueue";

export interface FriendGroupData {
  id: string;
  name: string;
  mode: "TOTAL" | "EQUILIBRADO";
  inviteCode: string;
  isOrganizer: boolean;
  members: number;
  season: { lengthDays: number; startsAt: string; endsAt: string; running: boolean } | null;
  rows: { memberId: string; name: string; image: string | null; position: number; pointsTenths: number; counted: number; contested: boolean; left: boolean; isMe: boolean }[];
}

/// Um grupo de amigos: placar da temporada, convite, nova temporada
/// (organizador) e sair.
export function FriendGroupView({ group, nowIso, workouts = {}, reviewCases = [] }: { group: FriendGroupData; nowIso: string; workouts?: Record<string, WorkoutForContest[]>; reviewCases?: ReviewCaseView[] }) {
  const [inspect, setInspect] = useState<{ memberId: string; name: string } | null>(null);
  const router = useRouter();
  const [length, setLength] = useState(String(group.season?.lengthDays ?? 14));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  async function post(url: string, body: unknown, after: () => void) {
    setBusy(true);
    setError(null);
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      setError((await response?.json().catch(() => null))?.message ?? "Não foi possível concluir. Tente de novo.");
      return;
    }
    after();
  }

  async function share() {
    const inviteUrl = `${window.location.origin}/painel/desafios/amigos/convite/${group.inviteCode}`;
    const text = `Entra no meu grupo "${group.name}" no FitOS Desafios: ${inviteUrl} (código ${group.inviteCode})`;
    try {
      if (navigator.share) await navigator.share({ title: group.name, text });
      else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
      }
    } catch {
      // Compartilhamento cancelado: nada a fazer.
    }
  }

  return (
    <section className={styles.panel} aria-label={group.name}>
      <p className={styles.muted}>
        {MODE_LABEL[group.mode]} · {group.members} {group.members === 1 ? "pessoa" : "pessoas"}
      </p>
      <p className={styles.season}>{seasonLabel(group.season, nowIso)}</p>
      <ReviewQueue cases={reviewCases} />

      {group.rows.length > 0 ? (
        <ol className={ranking.list} aria-label="Placar da temporada">
          {group.rows.map((row) => (
            <li key={row.memberId} className={row.isMe ? ranking.me : undefined}>
              <span className={ranking.position}>{row.position}º</span>
              <Avatar name={row.name} src={row.image} className={ranking.avatar} />
              <span className={ranking.name}>
                <strong>
                  {row.name}
                  {row.isMe ? " (você)" : ""}
                </strong>
                {row.left || row.contested ? <span className={ranking.muted}>{[row.left ? "saiu do grupo" : null, row.contested ? "em contestação" : null].filter(Boolean).join(" · ")}</span> : null}
              </span>
              <span className={ranking.points}>{formatPoints(row.pointsTenths)}</span>
              {!row.isMe && workouts[row.memberId] ? (
                <button type="button" className={styles.rowAction} onClick={() => setInspect({ memberId: row.memberId, name: row.name })} aria-label={`Ver treinos de ${row.name}`}>
                  Treinos
                </button>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className={styles.muted}>Ainda sem pontos nesta temporada.</p>
      )}
      <p className={styles.muted}>{MODE_HELP[group.mode]}</p>

      <div className={styles.invite}>
        <span className={styles.muted}>Código do convite</span>
        <strong className={styles.code}>{group.inviteCode}</strong>
        <Button type="button" variant="secondary" block onClick={() => void share()}>
          {copied ? "Convite copiado" : "Convidar amigos"}
        </Button>
      </div>

      {group.isOrganizer && !group.season?.running ? (
        <div className={styles.form}>
          <ChipGroup label="Nova temporada" showLabel tone="accent" value={length} onChange={setLength} options={[{ value: "7", label: "7 dias" }, { value: "14", label: "14 dias" }, { value: "28", label: "28 dias" }]} />
          <Button type="button" block disabled={busy} onClick={() => void post(`/api/desafios/amigos/${group.id}/temporada`, { lengthDays: Number(length) }, () => router.refresh())}>
            {busy ? "Começando…" : "Começar nova temporada"}
          </Button>
        </div>
      ) : null}

      {error ? <FormAlert variant="error">{error}</FormAlert> : null}

      {inspect ? <ContestSheet open onClose={() => setInspect(null)} name={inspect.name} workouts={workouts[inspect.memberId] ?? []} target={{ context: "AMIGOS", groupId: group.id }} /> : null}

      <Button type="button" variant="quiet" block onClick={() => setConfirmLeave(true)} disabled={busy}>
        Sair do grupo
      </Button>
      <Sheet
        open={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        title="Sair do grupo?"
        footer={
          <>
            <Button type="button" block disabled={busy} onClick={() => void post(`/api/desafios/amigos/${group.id}/sair`, {}, () => router.push("/painel/desafios?aba=amigos"))}>
              {busy ? "Saindo…" : "Sair do grupo"}
            </Button>
            <Button type="button" variant="quiet" block onClick={() => setConfirmLeave(false)}>
              Cancelar
            </Button>
          </>
        }
      >
        <p>Seus treinos param de contar e você deixa de ver o placar. Para voltar, use o convite de novo; a contagem recomeça.{group.isOrganizer ? " A organização passa para quem está há mais tempo no grupo." : ""}</p>
      </Sheet>
    </section>
  );
}
