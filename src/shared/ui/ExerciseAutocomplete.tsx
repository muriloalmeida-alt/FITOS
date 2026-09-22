"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import styles from "./ExerciseAutocomplete.module.css";

export interface ExerciseAutocompleteOption {
  id: string;
  name: string;
  muscle?: string | null;
}

interface ExerciseAutocompleteProps {
  label: string;
  options: ExerciseAutocompleteOption[];
  value: string;
  onChange: (exerciseId: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  name?: string;
}

const MAX_VISIBLE_OPTIONS = 8;

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/// Substitui o `<select>` nativo na montagem de treino (personal e
/// individual): com o catálogo curado da IMP-EX-002, o seletor passou a
/// ter mais de 200 opções — rolar uma lista nativa desse tamanho para
/// achar um exercício pelo nome é o problema relatado. `options` é a
/// lista completa do catálogo visível ao tenant (sem paginação, ver
/// `listCatalogExercisesForPicker`); a filtragem por texto acontece
/// inteiramente no cliente, sem round-trip de rede por tecla digitada —
/// simples e suficiente na escala atual (algumas centenas de itens).
export function ExerciseAutocomplete({
  label,
  options,
  value,
  onChange,
  placeholder,
  disabled,
  error,
  name,
}: ExerciseAutocompleteProps) {
  const generatedId = useId();
  const inputId = name ? `field-${name}` : generatedId;
  const listboxId = `${inputId}-listbox`;
  const errorId = `${inputId}-error`;
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((option) => option.id === value) ?? null;
  const [query, setQuery] = useState(selectedOption?.name ?? "");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  // Mantém o texto exibido sincronizado quando o formulário reseta
  // `value` para "" depois de adicionar o exercício (mesmo padrão de
  // `ItensDoModelo`/`ItensDoMeuTreino` limpando os campos após o submit).
  // Ajuste de estado durante a renderização (não em `useEffect`, que
  // causaria uma renderização em cascata) — padrão recomendado pelo React
  // para "adjusting state when a prop changes".
  const [lastSyncedOptionId, setLastSyncedOptionId] = useState(selectedOption?.id ?? null);
  if ((selectedOption?.id ?? null) !== lastSyncedOptionId) {
    setLastSyncedOptionId(selectedOption?.id ?? null);
    setQuery(selectedOption?.name ?? "");
  }

  const normalizedQuery = normalize(query);
  const filtered = normalizedQuery ? options.filter((option) => normalize(option.name).includes(normalizedQuery)) : options;
  const visible = filtered.slice(0, MAX_VISIBLE_OPTIONS);
  const hasMore = filtered.length > visible.length;

  function openWithFilter() {
    setIsOpen(true);
    setHighlightedIndex(0);
  }

  function selectOption(option: ExerciseAutocompleteOption) {
    onChange(option.id);
    setQuery(option.name);
    setIsOpen(false);
  }

  // Texto digitado que nunca foi confirmado (clique/Enter numa opção) é
  // descartado ao perder o foco — o seletor nunca fica com um texto
  // visível que não corresponde ao `exerciseId` de fato selecionado. O
  // `setTimeout` dá tempo do clique num item da lista (que também dispara
  // blur) chegar antes desta checagem.
  function handleBlur() {
    window.setTimeout(() => {
      if (!containerRef.current?.contains(document.activeElement)) {
        setIsOpen(false);
        setQuery(selectedOption?.name ?? "");
      }
    }, 0);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!isOpen) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        openWithFilter();
      }
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((index) => Math.min(index + 1, Math.max(visible.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      const target = visible[highlightedIndex];
      if (target) {
        event.preventDefault();
        selectOption(target);
      }
    } else if (event.key === "Escape") {
      setIsOpen(false);
      setQuery(selectedOption?.name ?? "");
    }
  }

  return (
    <div className={styles.field} ref={containerRef}>
      <label className={styles.label} htmlFor={inputId}>
        {label}
      </label>
      <div className={styles.comboboxWrapper}>
        <input
          id={inputId}
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={isOpen && visible[highlightedIndex] ? `${listboxId}-${visible[highlightedIndex].id}` : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={styles.input}
          autoComplete="off"
          value={query}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(event) => {
            const next = event.target.value;
            setQuery(next);
            if (next.trim() === "") {
              onChange("");
            }
            openWithFilter();
          }}
          onFocus={openWithFilter}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
        />
        {selectedOption ? (
          <button
            type="button"
            className={styles.clearButton}
            aria-label={`Limpar seleção de ${selectedOption.name}`}
            disabled={disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              onChange("");
              setQuery("");
              openWithFilter();
            }}
          >
            ×
          </button>
        ) : null}
      </div>
      {isOpen ? (
        <ul id={listboxId} role="listbox" className={styles.listbox}>
          {visible.length === 0 ? (
            <li className={styles.emptyOption} role="presentation">
              Nenhum exercício encontrado
            </li>
          ) : (
            visible.map((option, index) => (
              <li
                key={option.id}
                id={`${listboxId}-${option.id}`}
                role="option"
                aria-selected={option.id === value}
                className={index === highlightedIndex ? `${styles.option} ${styles.optionHighlighted}` : styles.option}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setHighlightedIndex(index)}
                onClick={() => selectOption(option)}
              >
                <span className={styles.optionName}>{option.name}</span>
                {option.muscle ? <span className={styles.optionMuscle}>{option.muscle}</span> : null}
              </li>
            ))
          )}
          {hasMore ? (
            <li className={styles.moreHint} role="presentation">
              Continue digitando para refinar…
            </li>
          ) : null}
        </ul>
      ) : null}
      {error ? (
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
