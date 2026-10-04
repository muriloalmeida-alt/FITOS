"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ActionRow, Button, ChipGroup, FormAlert, NextStepCard, SegmentedTabs, Sheet, Stepper, Tag, TextField, useToast } from "@/shared/ui";
import type { EvolutionSeries, MeasureChange } from "@/modules/evolution/evolutionSeries";
import { requestJson } from "../_workout-builder/apiClient";
import { EvolutionView } from "../_evolution/EvolutionView";
import styles from "./MinhaEvolucaoView.module.css";

export type EvolutionTab = "treinos" | "corpo" | "metas";

interface Props {
  tab: EvolutionTab;
  overview: { thisWeek: number; thisMonth: number; streakWeeks: number };
  records: { exerciseName: string; loadKg: number; reps: number | null; dateIso: string }[];
  history: { id: string; workoutName: string; dateIso: string; status: "CONCLUIDA" | "ABANDONADA"; effort: number | null }[];
  body: { series: EvolutionSeries[]; measures: MeasureChange[] };
  assessments: { id: string; dateIso: string; weightKg: number | null; bodyFatPercent: number | null; notes: string | null }[];
  goals: { id: string; description: string; targetIso: string | null; status: "EM_ANDAMENTO" | "CONCLUIDA" | "ABANDONADA"; closedIso: string | null }[];
}

const EFFORT = ["", "leve", "tranquilo", "moderado", "puxado", "no limite"];
const DEADLINES = [
  { value: "0", label: "Sem data" },
  { value: "1", label: "1 mês" },
  { value: "3", label: "3 meses" },
  { value: "6", label: "6 meses" },
];
const dateFmt = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Sao_Paulo" });

function fmt(value: number) {
  return (Math.round(value * 10) / 10).toLocaleString("pt-BR");
}

/// Minha evolução do FitOS Livre (FIT-159, L4 do protótipo): abas Treinos
/// (semana, mês, semanas seguidas, recordes por série e histórico), Corpo
/// (registrar peso e gordura com +/−, observação, excluir) e Metas.
export function MinhaEvolucaoView({ tab, overview, records, history, body, assessments, goals }: Props) {
  const router = useRouter();
  const toast = useToast();
  const last = assessments[0] ?? null;
  const [sheet, setSheet] = useState<null | "medida" | "meta" | { remove: string }>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weight, setWeight] = useState(last?.weightKg ?? 70);
  const [fat, setFat] = useState(last?.bodyFatPercent ?? 20);
  const [notes, setNotes] = useState("");
  const [goal, setGoal] = useState("");
  const [deadline, setDeadline] = useState("0");
  const open = goals.filter((entry) => entry.status === "EM_ANDAMENTO");
  const closed = goals.filter((entry) => entry.status !== "EM_ANDAMENTO");

  async function run(action: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError(null);
    try {
      await action();
      toast.show(message);
      setSheet(null);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }

  function openMeasure() {
    setWeight(last?.weightKg ?? 70);
    setFat(last?.bodyFatPercent ?? 20);
    setNotes("");
    setError(null);
    setSheet("medida");
  }

  return (
    <div className={styles.view}>
      <SegmentedTabs
        label="Minha evolução"
        value={tab}
        items={[
          { key: "treinos", label: "Treinos", href: "/painel/minha-evolucao" },
          { key: "corpo", label: "Corpo", href: "/painel/minha-evolucao?aba=corpo" },
          { key: "metas", label: "Metas", count: open.length, href: "/painel/minha-evolucao?aba=metas" },
        ]}
      />

      {tab === "treinos" ? (
        <>
          <ul className={styles.stats}>
            <li>
              <span className={styles.statValue}>{overview.thisWeek}</span> <span className={styles.muted}>na semana</span>
            </li>
            <li>
              <span className={styles.statValue}>{overview.thisMonth}</span> <span className={styles.muted}>no mês</span>
            </li>
            <li>
              <span className={styles.statValue}>{overview.streakWeeks}</span> <span className={styles.muted}>{overview.streakWeeks === 1 ? "semana seguida" : "semanas seguidas"}</span>
            </li>
          </ul>
          <h2 className={styles.title}>Recordes</h2>
          {records.length === 0 ? (
            <p className={styles.muted}>Seus recordes aparecem aqui conforme você registra as séries.</p>
          ) : (
            <ul className={styles.list}>
              {records.map((record) => (
                <li key={record.exerciseName}>
                  <ActionRow title={record.exerciseName} description={dateFmt.format(new Date(record.dateIso))} trailing={<strong>{`${fmt(record.loadKg)} kg${record.reps ? ` × ${record.reps}` : ""}`}</strong>} />
                </li>
              ))}
            </ul>
          )}
          <h2 className={styles.title}>Histórico</h2>
          {history.length === 0 ? (
            <p className={styles.muted}>Nenhum treino registrado ainda.</p>
          ) : (
            <ul className={styles.list}>
              {history.map((session) => (
                <li key={session.id}>
                  <ActionRow
                    title={
                      <>
                        {session.workoutName} {session.status === "CONCLUIDA" ? <Tag tone="ok">Concluído</Tag> : <Tag tone="muted">Abandonado</Tag>}
                      </>
                    }
                    description={[dateFmt.format(new Date(session.dateIso)), session.effort ? `esforço ${EFFORT[session.effort]}` : null].filter(Boolean).join(" · ")}
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}

      {tab === "corpo" ? (
        <>
          <NextStepCard eyebrow="Hoje" title="Registrar peso e gordura" description={last ? "Já começa com os últimos valores." : "Leva dez segundos."} onClick={openMeasure} />
          {body.series.length > 0 ? <EvolutionView series={body.series} measures={body.measures} /> : null}
          {assessments.length > 0 ? (
            <>
              <h2 className={styles.title}>Registros</h2>
              <ul className={styles.list}>
                {assessments.map((entry) => (
                  <li key={entry.id}>
                    <ActionRow
                      title={dateFmt.format(new Date(entry.dateIso))}
                      description={[entry.weightKg !== null ? `${fmt(entry.weightKg)} kg` : null, entry.bodyFatPercent !== null ? `${fmt(entry.bodyFatPercent)}% gordura` : null, entry.notes].filter(Boolean).join(" · ")}
                      trailing={
                        <Button type="button" variant="quiet" aria-label={`Excluir registro de ${dateFmt.format(new Date(entry.dateIso))}`} onClick={() => setSheet({ remove: entry.id })}>
                          Excluir
                        </Button>
                      }
                    />
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </>
      ) : null}

      {tab === "metas" ? (
        <>
          <NextStepCard eyebrow="Próximo passo" title="Nova meta" description="Escreva o que quer alcançar e escolha um prazo." onClick={() => { setGoal(""); setDeadline("0"); setError(null); setSheet("meta"); }} />
          <h2 className={styles.title}>Em andamento</h2>
          {open.length === 0 ? (
            <p className={styles.muted}>Nenhuma meta em andamento.</p>
          ) : (
            <ul className={styles.list}>
              {open.map((entry) => (
                <li key={entry.id}>
                  <ActionRow
                    title={entry.description}
                    description={entry.targetIso ? `até ${dateFmt.format(new Date(entry.targetIso))}` : "sem data"}
                    trailing={
                      <span className={styles.goalActions}>
                        <Button type="button" variant="quiet" disabled={busy} onClick={() => void run(() => requestJson(`/api/minhas-metas/${entry.id}/concluir`, { method: "POST" }), "Meta concluída!")}>
                          Concluí
                        </Button>
                        <Button type="button" variant="quiet" disabled={busy} aria-label={`Abandonar ${entry.description}`} onClick={() => void run(() => requestJson(`/api/minhas-metas/${entry.id}/abandonar`, { method: "POST" }), "Meta encerrada")}>
                          Abandonar
                        </Button>
                      </span>
                    }
                  />
                </li>
              ))}
            </ul>
          )}
          {closed.length > 0 ? (
            <>
              <h2 className={styles.title}>Encerradas</h2>
              <ul className={styles.list}>
                {closed.map((entry) => (
                  <li key={entry.id}>
                    <ActionRow
                      title={
                        <>
                          {entry.description} {entry.status === "CONCLUIDA" ? <Tag tone="ok">Concluída</Tag> : <Tag tone="muted">Abandonada</Tag>}
                        </>
                      }
                      description={entry.closedIso ? dateFmt.format(new Date(entry.closedIso)) : undefined}
                    />
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </>
      ) : null}

      <Sheet
        open={sheet === "medida"}
        onClose={() => setSheet(null)}
        title="Registrar medidas"
        description="Ajuste com + e −."
        footer={
          <>
            <Button type="button" block disabled={busy} onClick={() => void run(() => requestJson("/api/minhas-avaliacoes", { method: "POST", body: JSON.stringify({ weightKg: weight, bodyFatPercent: fat, notes: notes.trim() || null, measurementsCm: [] }) }), "Registro salvo")}>
              Salvar
            </Button>
            <Button type="button" variant="quiet" block onClick={() => setSheet(null)}>
              Agora não
            </Button>
          </>
        }
      >
        {error ? <FormAlert>{error}</FormAlert> : null}
        <div className={styles.stack}>
          <Stepper label="Peso (kg)" value={weight} step={0.1} min={20} max={300} format={(value) => fmt(value)} onChange={(value) => setWeight(Math.round(value * 10) / 10)} />
          <Stepper label="Gordura (%)" value={fat} step={0.5} min={2} max={70} format={(value) => fmt(value)} onChange={(value) => setFat(Math.round(value * 10) / 10)} />
          <TextField label="Observação (opcional)" value={notes} maxLength={300} onChange={(event) => setNotes(event.target.value)} />
        </div>
      </Sheet>

      <Sheet
        open={sheet === "meta"}
        onClose={() => setSheet(null)}
        title="Nova meta"
        footer={
          <>
            <Button
              type="button"
              block
              disabled={busy || goal.trim().length === 0}
              onClick={() => {
                const months = Number(deadline);
                const target = months > 0 ? new Date(new Date().setMonth(new Date().getMonth() + months)).toISOString() : null;
                void run(() => requestJson("/api/minhas-metas", { method: "POST", body: JSON.stringify({ description: goal.trim(), targetDate: target }) }), "Meta criada");
              }}
            >
              Criar meta
            </Button>
            <Button type="button" variant="quiet" block onClick={() => setSheet(null)}>
              Agora não
            </Button>
          </>
        }
      >
        {error ? <FormAlert>{error}</FormAlert> : null}
        <div className={styles.stack}>
          <TextField label="Sua meta" placeholder="Ex.: correr 5 km sem parar" value={goal} maxLength={200} onChange={(event) => setGoal(event.target.value)} />
          <ChipGroup label="Prazo" showLabel tone="accent" value={deadline} onChange={setDeadline} options={DEADLINES} />
        </div>
      </Sheet>

      <Sheet
        open={typeof sheet === "object" && sheet !== null}
        onClose={() => setSheet(null)}
        title="Excluir este registro?"
        description="Ele sai do gráfico e do histórico."
        footer={
          <>
            <Button type="button" variant="danger" block disabled={busy} onClick={() => typeof sheet === "object" && sheet !== null && void run(() => requestJson(`/api/minhas-avaliacoes/${sheet.remove}`, { method: "DELETE" }), "Registro excluído")}>
              Excluir
            </Button>
            <Button type="button" variant="quiet" block onClick={() => setSheet(null)}>
              Voltar
            </Button>
          </>
        }
      >
        {error ? <FormAlert>{error}</FormAlert> : null}
      </Sheet>
    </div>
  );
}
