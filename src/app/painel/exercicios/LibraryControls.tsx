"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button, ChipGroup, Sheet } from "@/shared/ui";
import { difficultyLabel } from "@/shared/lib/difficulty";
import { ExerciseFormSheet } from "./ExerciseForm";
import styles from "./LibraryControls.module.css";

interface LibraryControlsProps {
  muscles: string[];
  types: string[];
  difficulties: string[];
  openCreate: boolean;
}

/// Busca, filtros e "Cadastrar" da biblioteca (FIT-147). Tudo vira
/// parâmetro de URL (a lista é renderizada no servidor): busca com pausa
/// de 300 ms, músculo em chips, tipo e dificuldade numa sheet.
export function LibraryControls({ muscles, types, difficulties, openCreate }: LibraryControlsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(openCreate);
  const type = params.get("tipo");
  const difficulty = params.get("dificuldade");
  const muscle = params.get("musculo");
  const activeFilters = (type ? 1 : 0) + (difficulty ? 1 : 0);

  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    next.delete("pagina");
    next.delete("novo");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  useEffect(() => {
    if ((params.get("q") ?? "") === query) return;
    const timer = setTimeout(() => update({ q: query.trim() || null }), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <div className={styles.controls}>
      <div className={styles.searchRow}>
        <label className={styles.search}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome" aria-label="Buscar por nome" type="search" />
        </label>
        <Button type="button" variant="secondary" onClick={() => setFiltersOpen(true)}>
          {activeFilters ? `Filtros · ${activeFilters}` : "Filtros"}
        </Button>
      </div>
      <ChipGroup
        label="Filtrar por músculo"
        variant="scroll"
        tone="light"
        value={muscle ?? "__todos__"}
        onChange={(value) => update({ musculo: value === "__todos__" ? null : value })}
        options={[{ value: "__todos__", label: "Todos" }, ...muscles.map((m) => ({ value: m, label: m }))]}
      />
      <Button type="button" variant="quiet" onClick={() => setCreateOpen(true)}>
        + Cadastrar exercício próprio
      </Button>

      <Sheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filtros"
        footer={
          <>
            <Button type="button" block onClick={() => setFiltersOpen(false)}>
              Mostrar resultados
            </Button>
            <Button
              type="button"
              variant="quiet"
              block
              onClick={() => {
                update({ tipo: null, dificuldade: null, musculo: null, q: null });
                setQuery("");
                setFiltersOpen(false);
              }}
            >
              Limpar filtros
            </Button>
          </>
        }
      >
        <div className={styles.sheetGroups}>
          <ChipGroup label="Tipo" showLabel tone="accent" value={type} allowDeselect onClear={() => update({ tipo: null })} onChange={(value) => update({ tipo: value })} options={types.map((t) => ({ value: t, label: t }))} />
          <ChipGroup
            label="Dificuldade"
            showLabel
            tone="accent"
            value={difficulty}
            allowDeselect
            onClear={() => update({ dificuldade: null })}
            onChange={(value) => update({ dificuldade: value })}
            options={difficulties.map((d) => ({ value: d, label: difficultyLabel(d) ?? d }))}
          />
        </div>
      </Sheet>

      {createOpen ? <ExerciseFormSheet open onClose={() => setCreateOpen(false)} muscles={muscles} types={types} /> : null}
    </div>
  );
}
