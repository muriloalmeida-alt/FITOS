"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button, ChipGroup, Sheet } from "@/shared/ui";
import { difficultyLabel } from "@/shared/lib/difficulty";
import { ExerciseFormSheet } from "./ExerciseForm";
import styles from "./LibraryControls.module.css";

interface LibraryControlsProps {
  muscles: string[];
  types: string[];
  difficulties: string[];
  /// Modalidades existentes no catálogo (Musculação, Funcional, CrossFit…).
  categories?: string[];
  openCreate: boolean;
}

/// Filtros da biblioteca (proposta 8): seleção única por grupo; `null` é
/// "Todos/Todas" e não conta como filtro ativo.
interface Filters {
  origem: string | null;
  categoria: string | null;
  musculo: string | null;
  tipo: string | null;
  dificuldade: string | null;
}

const EMPTY: Filters = { origem: null, categoria: null, musculo: null, tipo: null, dificuldade: null };
const ORIGIN_LABEL: Record<string, string> = { biblioteca: "Biblioteca FitOS", meus: "Meus" };
const DEBOUNCE_MS = 250;

/// Quantos grupos têm seleção diferente de Todos/Todas (a busca não conta).
export function activeFilterCount(filters: Filters): number {
  return Object.values(filters).filter(Boolean).length;
}

/// Busca e filtros da biblioteca (proposta 8, aprovada em 11/10/2026).
/// Busca no topo ("Buscar exercício", 250 ms, sem perder o foco), um botão
/// "Filtrar exercícios" com o número de filtros ativos, só os filtros
/// aplicados na página (cada um com remover) e a modal com rascunho:
/// "Ver resultados" aplica, "Limpar" volta ao padrão, fechar descarta. Com
/// o teclado aberto, cabeçalho, abas, navegação e o + saem da frente.
export function LibraryControls({ muscles, types, difficulties, categories = [], openCreate }: LibraryControlsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [editing, setEditing] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(openCreate);
  const input = useRef<HTMLInputElement>(null);
  const applied: Filters = {
    origem: params.get("origem"),
    categoria: params.get("categoria"),
    musculo: params.get("musculo"),
    tipo: params.get("tipo"),
    dificuldade: params.get("dificuldade"),
  };
  const [draft, setDraft] = useState<Filters>(applied);
  const count = activeFilterCount(applied);

  function update(changes: Partial<Record<keyof Filters | "q", string | null>>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    next.delete("pagina");
    next.delete("novo");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  // Resultados durante a digitação; o input não é recriado (foco mantido).
  useEffect(() => {
    if ((params.get("q") ?? "") === query) return;
    const timer = setTimeout(() => update({ q: query.trim() || null }), DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Teclado aberto: o corpo da página sinaliza para o CSS recolher o resto.
  useEffect(() => {
    if (editing) document.body.dataset.keyboard = "open";
    else delete document.body.dataset.keyboard;
    return () => {
      delete document.body.dataset.keyboard;
    };
  }, [editing]);

  function finishSearch() {
    input.current?.blur();
    setEditing(false);
  }

  function openFilters() {
    // Fecha o teclado antes da modal, para não sobrepor.
    input.current?.blur();
    setEditing(false);
    setDraft(applied);
    setMoreOpen(Boolean(applied.tipo || applied.dificuldade));
    setFiltersOpen(true);
  }

  function apply() {
    update(draft);
    setFiltersOpen(false);
  }

  const chips = [
    applied.origem ? { key: "origem" as const, label: ORIGIN_LABEL[applied.origem] ?? applied.origem } : null,
    applied.categoria ? { key: "categoria" as const, label: applied.categoria } : null,
    applied.musculo ? { key: "musculo" as const, label: applied.musculo } : null,
    applied.tipo ? { key: "tipo" as const, label: applied.tipo } : null,
    applied.dificuldade ? { key: "dificuldade" as const, label: difficultyLabel(applied.dificuldade) ?? applied.dificuldade } : null,
  ].filter((chip): chip is { key: keyof Filters; label: string } => chip !== null);

  return (
    <div className={styles.controls}>
      <div className={styles.searchRow}>
        <label className={styles.search}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            ref={input}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => setEditing(true)}
            onBlur={() => setEditing(false)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                finishSearch();
              }
            }}
            placeholder="Buscar exercício"
            aria-label="Buscar exercício"
            type="search"
            enterKeyHint="search"
            autoComplete="off"
          />
          {query ? (
            <button
              type="button"
              className={styles.clear}
              aria-label="Limpar busca"
              // Mantém o foco no campo: limpar só o texto.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setQuery("")}
            >
              ×
            </button>
          ) : null}
        </label>
        {editing ? (
          <button type="button" className={styles.done} onMouseDown={(event) => event.preventDefault()} onClick={finishSearch}>
            Concluir busca
          </button>
        ) : (
          <button type="button" className={styles.filterButton} aria-label={count ? `Filtrar exercícios, ${count} ${count === 1 ? "ativo" : "ativos"}` : "Filtrar exercícios"} onClick={openFilters}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M4 6h16M7 12h10M10 18h4" />
            </svg>
            {count ? (
              <span className={styles.badge} aria-hidden="true">
                {count}
              </span>
            ) : null}
          </button>
        )}
      </div>

      {chips.length ? (
        <ul className={styles.chips} aria-label="Filtros aplicados">
          {chips.map((chip) => (
            <li key={chip.key}>
              <span>{chip.label}</span>
              <button type="button" aria-label={`Remover filtro ${chip.label}`} onClick={() => update({ [chip.key]: null })}>
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <Sheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filtrar exercícios"
        footer={
          <div className={styles.footer}>
            <Button type="button" variant="secondary" onClick={() => setDraft(EMPTY)}>
              Limpar
            </Button>
            <Button type="button" onClick={apply}>
              Ver resultados
            </Button>
          </div>
        }
      >
        <div className={styles.sheetGroups}>
          <ChipGroup
            label="Origem"
            showLabel
            tone="accent"
            value={draft.origem ?? "todos"}
            onChange={(value) => setDraft({ ...draft, origem: value === "todos" ? null : value })}
            options={[{ value: "todos", label: "Todos" }, { value: "biblioteca", label: "Biblioteca FitOS" }, { value: "meus", label: "Meus" }]}
          />
          {categories.length ? (
            <ChipGroup
              label="Modalidade"
              showLabel
              tone="accent"
              value={draft.categoria ?? "__todas__"}
              onChange={(value) => setDraft({ ...draft, categoria: value === "__todas__" ? null : value })}
              options={[{ value: "__todas__", label: "Todas" }, ...categories.map((value) => ({ value, label: value }))]}
            />
          ) : null}
          <ChipGroup
            label="Grupo muscular"
            showLabel
            tone="accent"
            value={draft.musculo ?? "__todos__"}
            onChange={(value) => setDraft({ ...draft, musculo: value === "__todos__" ? null : value })}
            options={[{ value: "__todos__", label: "Todos" }, ...muscles.map((value) => ({ value, label: value }))]}
          />
          <button type="button" className={styles.more} aria-expanded={moreOpen} onClick={() => setMoreOpen(!moreOpen)}>
            Mais filtros <span aria-hidden="true">{moreOpen ? "⌃" : "⌄"}</span>
          </button>
          {moreOpen ? (
            <>
              <ChipGroup label="Tipo" showLabel tone="accent" value={draft.tipo} allowDeselect onClear={() => setDraft({ ...draft, tipo: null })} onChange={(value) => setDraft({ ...draft, tipo: value })} options={types.map((value) => ({ value, label: value }))} />
              <ChipGroup
                label="Dificuldade"
                showLabel
                tone="accent"
                value={draft.dificuldade}
                allowDeselect
                onClear={() => setDraft({ ...draft, dificuldade: null })}
                onChange={(value) => setDraft({ ...draft, dificuldade: value })}
                options={difficulties.map((value) => ({ value, label: difficultyLabel(value) ?? value }))}
              />
            </>
          ) : null}
        </div>
      </Sheet>

      <button type="button" className={styles.create} onClick={() => setCreateOpen(true)} data-search-hide="">
        + Cadastrar exercício próprio
      </button>
      {createOpen ? <ExerciseFormSheet open onClose={() => setCreateOpen(false)} muscles={muscles} types={types} /> : null}
    </div>
  );
}
