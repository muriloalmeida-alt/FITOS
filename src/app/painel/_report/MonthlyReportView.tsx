"use client";

import Link from "next/link";
import { Button, useToast } from "@/shared/ui";
import { shareReportImage } from "../_live/shareImage";
import styles from "./MonthlyReport.module.css";

export interface MonthlyReportData {
  label: string;
  sessions: number;
  days: number;
  activeMinutes: number;
  sets: number;
  volumeKg: number;
  previous: { sessions: number; volumeKg: number };
  records: { exerciseName: string; loadKg: number }[];
  gains: { exerciseName: string; fromKg: number; toKg: number }[];
  body: { weightFrom: number | null; weightTo: number | null; fatFrom: number | null; fatTo: number | null } | null;
  photos: { id: string; pose: string; takenIso: string }[];
}

const br = (value: number) => String(value).replace(".", ",");
const thousands = (value: number) => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const dateLabel = (iso: string) => new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", timeZone: "America/Sao_Paulo" }).format(new Date(iso));

function delta(now: number, before: number, unit = ""): string | null {
  if (before === 0) return null;
  const diff = now - before;
  if (diff === 0) return "igual ao mês anterior";
  return `${diff > 0 ? "+" : "−"}${thousands(Math.abs(diff))}${unit} que o mês anterior`;
}

function change(from: number | null, to: number | null, unit: string): string | null {
  if (to === null) return null;
  if (from === null) return `${br(to)} ${unit}`;
  const diff = Math.round((to - from) * 10) / 10;
  return `${br(from)} → ${br(to)} ${unit} (${diff > 0 ? "+" : diff < 0 ? "−" : ""}${br(Math.abs(diff))})`;
}

/// Relatório do mês (EPIC-45): números grandes, comparação com o mês
/// anterior, recordes, cargas que subiram, corpo e fotos; compartilhável
/// como imagem.
export function MonthlyReportView({ report, name, prevHref, nextHref, shareable = true }: { report: MonthlyReportData; name: string; prevHref: string | null; nextHref: string | null; shareable?: boolean }) {
  const toast = useToast();
  const empty = report.sessions === 0 && !report.body && report.photos.length === 0;
  const weight = report.body ? change(report.body.weightFrom, report.body.weightTo, "kg") : null;
  const fat = report.body ? change(report.body.fatFrom, report.body.fatTo, "% de gordura") : null;

  return (
    <div className={styles.report}>
      <nav className={styles.months} aria-label="Mês">
        {prevHref ? (
          <Link href={prevHref} aria-label="Mês anterior">
            ‹
          </Link>
        ) : (
          <span />
        )}
        <strong>{report.label}</strong>
        {nextHref ? (
          <Link href={nextHref} aria-label="Próximo mês">
            ›
          </Link>
        ) : (
          <span />
        )}
      </nav>

      {empty ? (
        <p className={styles.empty}>Nenhum treino neste mês.</p>
      ) : (
        <>
          <dl className={styles.stats}>
            <div>
              <dt>treinos</dt>
              <dd>{report.sessions}</dd>
              {delta(report.sessions, report.previous.sessions) ? <span>{delta(report.sessions, report.previous.sessions)}</span> : null}
            </div>
            <div>
              <dt>dias treinando</dt>
              <dd>{report.days}</dd>
            </div>
            <div>
              <dt>tempo ativo</dt>
              <dd>{report.activeMinutes >= 120 ? `${Math.round(report.activeMinutes / 60)} h` : `${report.activeMinutes} min`}</dd>
            </div>
            <div>
              <dt>kg levantados</dt>
              <dd>{thousands(report.volumeKg)}</dd>
              {delta(report.volumeKg, report.previous.volumeKg, " kg") ? <span>{delta(report.volumeKg, report.previous.volumeKg, " kg")}</span> : null}
            </div>
          </dl>

          {report.records.length > 0 ? (
            <section className={styles.block}>
              <h2>Recordes</h2>
              <ul>
                {report.records.map((record) => (
                  <li key={record.exerciseName}>
                    <span aria-hidden="true">★</span> {record.exerciseName}: <strong>{br(record.loadKg)} kg</strong>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {report.gains.length > 0 ? (
            <section className={styles.block}>
              <h2>Cargas que subiram</h2>
              <ul>
                {report.gains.map((gain) => (
                  <li key={gain.exerciseName}>
                    {gain.exerciseName}: {br(gain.fromKg)} → <strong>{br(gain.toKg)} kg</strong>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {weight || fat ? (
            <section className={styles.block}>
              <h2>Corpo</h2>
              <ul>
                {weight ? <li>Peso: {weight}</li> : null}
                {fat ? <li>Gordura: {fat}</li> : null}
              </ul>
            </section>
          ) : null}

          {report.photos.length > 0 ? (
            <section className={styles.block}>
              <h2>Fotos do mês</h2>
              <div className={styles.photos}>
                {report.photos.map((photo) => (
                  <figure key={photo.id}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- foto privada servida por rota autenticada; next/image não serve aqui */}
                    <img src={`/api/fotos-evolucao/${photo.id}`} alt={`Foto de ${dateLabel(photo.takenIso)}`} loading="lazy" />
                    <figcaption>{dateLabel(photo.takenIso)}</figcaption>
                  </figure>
                ))}
              </div>
            </section>
          ) : null}

          {shareable && report.sessions > 0 ? (
            <Button
              type="button"
              variant="secondary"
              block
              onClick={() =>
                void shareReportImage({ label: report.label, name, sessions: report.sessions, days: report.days, minutes: report.activeMinutes, volumeKg: report.volumeKg, records: report.records.length }).then((outcome) => {
                  if (outcome === "downloaded") toast.show("Imagem salva");
                })
              }
            >
              Compartilhar o mês
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}
