"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ActionRow, Button, ChipGroup, FormAlert } from "@/shared/ui";
import { FRIEND_RULES, MODE_HELP, MODE_LABEL, seasonLabel } from "./friendTexts";
import styles from "./FriendGroups.module.css";

export interface FriendGroupItem {
  id: string;
  name: string;
  mode: "TOTAL" | "EQUILIBRADO";
  members: number;
  season: { lengthDays: number; startsAt: string; endsAt: string; running: boolean } | null;
  myPosition: number | null;
}

/// Amigos (Desafios 4/4): seus grupos, criar um grupo e entrar por código.
export function FriendGroupsPanel({ groups, nowIso }: { groups: FriendGroupItem[]; nowIso: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"create" | "join" | null>(groups.length === 0 ? "create" : null);
  const [name, setName] = useState("");
  const [scoring, setScoring] = useState<"TOTAL" | "EQUILIBRADO">("EQUILIBRADO");
  const [length, setLength] = useState("14");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(url: string, body: unknown) {
    setBusy(true);
    setError(null);
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const json = await response?.json().catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      setError(json?.message ?? "Não foi possível concluir. Tente de novo.");
      return;
    }
    router.push(`/painel/desafios/amigos/${json.groupId}`);
  }

  return (
    <section className={styles.panel} aria-label="Amigos">
      {groups.length > 0 ? (
        <ul className={styles.list}>
          {groups.map((group) => (
            <li key={group.id}>
              <ActionRow
                href={`/painel/desafios/amigos/${group.id}`}
                title={group.name}
                description={[`${group.members} ${group.members === 1 ? "pessoa" : "pessoas"}`, MODE_LABEL[group.mode], seasonLabel(group.season, nowIso)].join(" · ")}
                trailing={group.myPosition ? <strong>{group.myPosition}º</strong> : <span aria-hidden="true">›</span>}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.muted}>Crie um grupo e chame amigos para uma temporada, mesmo que treinem com personais diferentes ou no FitOS Livre.</p>
      )}

      <div className={styles.actions}>
        <Button type="button" variant={mode === "create" ? "filled" : "secondary"} block onClick={() => setMode(mode === "create" ? null : "create")}>
          Criar grupo
        </Button>
        <Button type="button" variant={mode === "join" ? "filled" : "secondary"} block onClick={() => setMode(mode === "join" ? null : "join")}>
          Entrar com código
        </Button>
      </div>

      {mode === "create" ? (
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            void send("/api/desafios/amigos", { name, mode: scoring, lengthDays: Number(length) });
          }}
        >
          <label className={styles.field}>
            <span>Nome do grupo</span>
            <input value={name} maxLength={40} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Corrida de sábado" />
          </label>
          <ChipGroup label="Como os pontos contam" showLabel tone="accent" value={scoring} onChange={(value) => setScoring(value as "TOTAL" | "EQUILIBRADO")} options={[{ value: "EQUILIBRADO", label: MODE_LABEL.EQUILIBRADO }, { value: "TOTAL", label: MODE_LABEL.TOTAL }]} />
          <p className={styles.muted}>{MODE_HELP[scoring]}</p>
          <ChipGroup label="Temporada" showLabel tone="accent" value={length} onChange={setLength} options={[{ value: "7", label: "7 dias" }, { value: "14", label: "14 dias" }, { value: "28", label: "28 dias" }]} />
          <ul className={styles.rules}>
            {FRIEND_RULES.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
          <Button type="submit" size="lg" block disabled={busy}>
            {busy ? "Criando…" : "Criar e começar a temporada"}
          </Button>
        </form>
      ) : null}

      {mode === "join" ? (
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            router.push(`/painel/desafios/amigos/convite/${encodeURIComponent(code.trim())}`);
          }}
        >
          <label className={styles.field}>
            <span>Código do convite</span>
            <input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="Ex.: K7QX2M9P" autoCapitalize="characters" />
          </label>
          <Button type="submit" size="lg" block disabled={code.trim().length < 6}>
            Ver o grupo
          </Button>
        </form>
      ) : null}

      {error ? <FormAlert variant="error">{error}</FormAlert> : null}
    </section>
  );
}
