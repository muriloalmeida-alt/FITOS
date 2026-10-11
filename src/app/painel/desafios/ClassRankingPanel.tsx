"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar, Button, FormAlert, Switch } from "@/shared/ui";
import { formatPoints } from "@/shared/lib/scoring";
import styles from "./ClassRankingPanel.module.css";

export interface RankingRowView {
  studentId: string;
  name: string;
  image: string | null;
  position: number;
  pointsTenths: number;
  counted: number;
  contested: boolean;
  isMe: boolean;
}

interface Props {
  role: "PERSONAL" | "ALUNO";
  enabled: boolean;
  /// Aluno: já aderiu.
  joined: boolean;
  period: "semana" | "mes";
  /// `null` quando não pode ver (desligado ou sem adesão).
  rows: RankingRowView[] | null;
  basePath: string;
}

const RULES = [
  "Cada treino vale a média de pontos por exercício previsto (modo equilibrado).",
  "Contam os 3 melhores treinos da semana, no máximo 1 por dia.",
  "Só contam treinos com foto, feitos depois que você entrou.",
  "A turma vê seu nome, foto e pontos. Nunca cargas, programa ou dados de saúde.",
];

/// Ranking da turma (Desafios): o personal liga/desliga e acompanha; o
/// aluno entra por vontade própria, vê a turma e pode sair quando quiser.
export function ClassRankingPanel({ role, enabled, joined, period, rows, basePath }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(url: string, init: RequestInit) {
    setBusy(true);
    setError(null);
    const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } }).catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      const body = await response?.json().catch(() => null);
      setError(body?.message ?? "Não foi possível concluir. Tente de novo.");
      return;
    }
    router.refresh();
  }

  const toggle =
    role === "PERSONAL" ? (
      <div className={styles.toggle}>
        <Switch label="Ranking da turma" checked={enabled} onChange={(next) => (busy ? undefined : void call("/api/desafios/turma", { method: "PATCH", body: JSON.stringify({ enabled: next }) }))} />
        <p className={styles.muted}>{enabled ? "Ligado. Alunos ativos podem entrar pela tela Desafios." : "Desligado. Ligar começa uma temporada nova: treinos de antes não entram."}</p>
      </div>
    ) : null;

  if (!enabled) {
    return (
      <section className={styles.panel} aria-label="Ranking da turma">
        {toggle}
        {role === "ALUNO" ? <p className={styles.muted}>Seu personal ainda não ligou o ranking da turma.</p> : null}
        {error ? <FormAlert variant="error">{error}</FormAlert> : null}
      </section>
    );
  }

  if (role === "ALUNO" && !joined) {
    return (
      <section className={styles.panel} aria-label="Ranking da turma">
        <h2 className={styles.title}>Entrar no ranking da turma?</h2>
        <ul className={styles.rules}>
          {RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
        {error ? <FormAlert variant="error">{error}</FormAlert> : null}
        <Button type="button" size="lg" block disabled={busy} onClick={() => void call("/api/desafios/turma/participar", { method: "POST" })}>
          {busy ? "Entrando…" : "Entrar no ranking"}
        </Button>
      </section>
    );
  }

  return (
    <section className={styles.panel} aria-label="Ranking da turma">
      {toggle}
      <nav className={styles.periods} aria-label="Período">
        <Link href={`${basePath}&periodo=semana`} aria-current={period === "semana" ? "page" : undefined}>
          Semana
        </Link>
        <Link href={`${basePath}&periodo=mes`} aria-current={period === "mes" ? "page" : undefined}>
          Mês
        </Link>
      </nav>
      {rows && rows.length > 0 ? (
        <ol className={styles.list}>
          {rows.map((row) => (
            <li key={row.studentId} className={row.isMe ? styles.me : undefined}>
              <span className={styles.position}>{row.position}º</span>
              <Avatar name={row.name} src={row.image} className={styles.avatar} />
              <span className={styles.name}>
                <strong>
                  {row.name}
                  {row.isMe ? " (você)" : ""}
                </strong>
                {role === "PERSONAL" ? (
                  <span className={styles.muted}>
                    {row.counted} {row.counted === 1 ? "treino" : "treinos"} na conta{row.contested ? " · em contestação" : ""}
                  </span>
                ) : row.contested ? (
                  <span className={styles.muted}>em contestação</span>
                ) : null}
              </span>
              <span className={styles.points}>{formatPoints(row.pointsTenths)}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className={styles.muted}>Ninguém entrou no ranking ainda. Os alunos entram pela tela Desafios.</p>
      )}
      <p className={styles.muted}>Modo equilibrado: média por exercício, 3 melhores treinos da semana, 1 por dia.</p>
      {error ? <FormAlert variant="error">{error}</FormAlert> : null}
      {role === "ALUNO" ? (
        <Button type="button" variant="quiet" block disabled={busy} onClick={() => void call("/api/desafios/turma/participar", { method: "DELETE" })}>
          Sair do ranking
        </Button>
      ) : null}
    </section>
  );
}
