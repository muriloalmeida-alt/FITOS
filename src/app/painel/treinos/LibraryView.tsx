"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, CardioIcon, ChipGroup, ExerciseThumbnail, FormAlert, SegmentedTabs, Sheet } from "@/shared/ui";
import styles from "./LibraryView.module.css";

export interface LibraryViewEntry {
  id: string;
  name: string;
  meta: string;
  thumbnails: string[];
  cardio: boolean;
  /// Duração estimada (treinos e aeróbicos).
  minutes?: number | null;
  lines: { name: string; dose: string }[];
}

export type LibraryTab = "programas" | "treinos" | "aerobicos";

interface Props {
  tab: LibraryTab;
  entries: Record<LibraryTab, LibraryViewEntry[]>;
  students: { id: string; name: string }[];
  preselectedStudentId?: string | null;
  /// FitOS Livre: "Usar" copia para os próprios treinos, sem alunos.
  mode?: "personal" | "livre";
}

const TABS: { key: LibraryTab; label: string }[] = [
  { key: "programas", label: "Programas" },
  { key: "treinos", label: "Treinos" },
  { key: "aerobicos", label: "Aeróbicos" },
];

const DURATIONS = [30, 45, 60] as const;

/// Faixa de tempo do treino (EPIC-32): o mais próximo de 30, 45 ou 60 min.
export function durationBucket(minutes: number): (typeof DURATIONS)[number] {
  return minutes <= 37 ? 30 : minutes <= 52 ? 45 : 60;
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? name;
}

/// Biblioteca do personal (EPIC-28): programas, treinos e aeróbicos
/// prontos. Toque num item, escolha os alunos e aplique: cada um recebe a
/// própria cópia. No FitOS Livre, o mesmo catálogo pronto: "Usar" copia o
/// item para "Meus treinos".
export function LibraryView({ tab, entries, students, preselectedStudentId = null, mode = "personal" }: Props) {
  const livre = mode === "livre";
  const base = livre ? "/painel/meus-treinos/biblioteca" : "/painel/treinos";
  const [used, setUsed] = useState<string[] | null>(null);
  const router = useRouter();
  const [open, setOpen] = useState<LibraryViewEntry | null>(null);
  const [picked, setPicked] = useState<string[]>(preselectedStudentId ? [preselectedStudentId] : []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<{ count: number; firstId: string } | null>(null);
  const [duration, setDuration] = useState<(typeof DURATIONS)[number] | null>(null);
  const timed = tab !== "programas";
  const list = entries[tab].filter((entry) => !timed || duration === null || (entry.minutes != null && durationBucket(entry.minutes) === duration));
  const editHref = (entry: LibraryViewEntry) => (tab === "programas" ? `/painel/treinos/planos/${entry.id}` : `/painel/treinos/${entry.id}`);
  const nameOf = (id: string) => students.find((student) => student.id === id)?.name ?? "";

  async function apply() {
    if (!open || picked.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    const response = await fetch("/api/biblioteca/aplicar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: tab === "programas" ? "programa" : "treino", id: open.id, studentIds: picked }),
    });
    setBusy(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.message ?? "Não foi possível aplicar. Tente de novo.");
      return;
    }
    setApplied({ count: picked.length, firstId: picked[0]! });
    router.refresh();
  }

  async function takeItem() {
    if (!open || busy) return;
    setBusy(true);
    setError(null);
    const response = await fetch("/api/livre/biblioteca", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: tab === "programas" ? "programa" : "treino", key: open.id }),
    });
    setBusy(false);
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      setError(body?.message ?? "Não foi possível usar. Tente de novo.");
      return;
    }
    setUsed(body?.workoutIds ?? []);
    router.refresh();
  }

  function close() {
    setOpen(null);
    setApplied(null);
    setUsed(null);
    setError(null);
  }

  return (
    <>
      <SegmentedTabs label="Biblioteca" value={tab} items={TABS.map((item) => ({ key: item.key, label: item.label, href: `${base}?aba=${item.key}` }))} />

      {timed ? (
        <div className={styles.durations} role="radiogroup" aria-label="Tempo por dia">
          {[null, ...DURATIONS].map((value) => (
            <button key={String(value)} type="button" role="radio" aria-checked={duration === value} className={duration === value ? `${styles.duration} ${styles.durationOn}` : styles.duration} onClick={() => setDuration(value)}>
              {value === null ? "Todos" : `${value} min`}
            </button>
          ))}
        </div>
      ) : null}

      {list.length === 0 ? (
        <p className={styles.empty}>{duration ? `Nenhum de ${duration} min aqui.` : "Nada aqui ainda."}</p>
      ) : (
        <ul className={styles.list} aria-label={TABS.find((item) => item.key === tab)!.label}>
          {list.map((entry) => (
            <li key={entry.id}>
              <button type="button" className={styles.card} onClick={() => setOpen(entry)}>
                {entry.thumbnails.length === 0 ? (
                  <CardioIcon size={48} />
                ) : (
                  <span className={styles.thumbs} aria-hidden="true">
                    {entry.thumbnails.map((src) => (
                      <ExerciseThumbnail key={src} src={src} alt="" width={40} height={40} className={styles.thumb} />
                    ))}
                  </span>
                )}
                <span className={styles.text}>
                  <span className={styles.name}>{entry.name}</span>
                  <span className={styles.meta}>{entry.meta}</span>
                </span>
                <span className={styles.chev} aria-hidden="true">
                  ›
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {livre ? (
        <Button href="/painel/meus-treinos/novo" variant="secondary" block>
          Montar meu treino
        </Button>
      ) : (
        <Button href={tab === "programas" ? "/painel/treinos/planos/novo" : "/painel/treinos/novo"} variant="secondary" block>
          {tab === "programas" ? "Criar programa" : tab === "aerobicos" ? "Criar aeróbico" : "Criar treino"}
        </Button>
      )}

      <Sheet
        open={open !== null && applied === null && used === null}
        onClose={close}
        title={open?.name ?? ""}
        description={livre && tab === "programas" ? `${open?.meta ?? ""}. Seus treinos atuais vão para Arquivados.` : open?.meta}
        footer={
          livre ? (
            <Button type="button" block disabled={busy} onClick={() => void takeItem()}>
              {busy ? "Preparando…" : tab === "programas" ? "Começar este programa" : tab === "aerobicos" ? "Usar este aeróbico" : "Usar este treino"}
            </Button>
          ) : (
          <>
            <Button type="button" block disabled={picked.length === 0 || busy} onClick={() => void apply()}>
              {busy ? "Aplicando…" : picked.length <= 1 ? `Aplicar para ${picked[0] ? firstName(nameOf(picked[0])) : "…"}` : `Aplicar para ${picked.length} alunos`}
            </Button>
            {open ? (
              <Button href={editHref(open)} variant="quiet" block>
                Editar modelo
              </Button>
            ) : null}
          </>
          )
        }
      >
        {open ? (
          <div className={styles.detail}>
            <ul className={styles.lines}>
              {open.lines.map((line, index) => (
                <li key={`${line.name}-${index}`}>
                  <span>{line.name}</span>
                  <span className={styles.meta}>{line.dose}</span>
                </li>
              ))}
            </ul>
            {error ? <FormAlert variant="error">{error}</FormAlert> : null}
            {livre ? null : students.length === 0 ? (
              <p className={styles.meta}>Convide um aluno para aplicar.</p>
            ) : (
              <ChipGroup label="Aplicar para" showLabel multiple tone="accent" value={picked} onChange={setPicked} options={students.map((student) => ({ value: student.id, label: firstName(student.name) }))} />
            )}
          </div>
        ) : null}
      </Sheet>

      <Sheet
        open={applied !== null}
        onClose={close}
        title={applied && applied.count > 1 ? `${applied.count} cópias criadas` : `Cópia criada para ${applied ? firstName(nameOf(applied.firstId)) : ""}`}
        description="Cada aluno recebe a própria cópia. Mudar a cópia não altera o modelo da biblioteca."
        footer={
          <>
            {applied ? (
              <Button href={`/painel/alunos/${applied.firstId}/treino`} block>
                Ajustar a cópia de {firstName(nameOf(applied.firstId))}
              </Button>
            ) : null}
            <Button type="button" variant="quiet" block onClick={close}>
              Voltar à biblioteca
            </Button>
          </>
        }
      />

      <Sheet
        open={used !== null}
        onClose={close}
        title={tab === "programas" ? "Programa pronto" : "Está nos seus treinos"}
        description={tab === "programas" ? "Os treinos do programa já estão nos seus dias. Os anteriores ficaram em Arquivados." : "Ajuste como quiser: a biblioteca não muda."}
        footer={
          <>
            {used && used.length === 1 ? (
              <Button href={`/painel/meus-treinos/sessao?treino=${used[0]}`} block>
                Começar agora
              </Button>
            ) : null}
            <Button href="/painel/meus-treinos" variant={used && used.length === 1 ? "quiet" : "filled"} block>
              Ver meus treinos
            </Button>
          </>
        }
      />
    </>
  );
}
