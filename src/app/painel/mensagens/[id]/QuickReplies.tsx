"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Button, FormAlert, Sheet } from "@/shared/ui";
import { requestJson } from "../../_workout-builder/apiClient";
import styles from "../Mensagens.module.css";

/// Respostas rápidas do personal (EPIC-41): toque para colocar no campo
/// (dá para ajustar antes de enviar); "Editar" muda a lista. A folha vai
/// para o `body`: dentro do campo fixo ficaria por baixo do menu.
export function QuickReplies({
  replies: initial,
  onPick,
  disabled,
}: {
  replies: string[];
  onPick: (text: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [replies, setReplies] = useState(initial);
  const [editing, setEditing] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!editing) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await requestJson<{ replies: string[] }>(
        "/api/mensagens/respostas-rapidas",
        { method: "PUT", body: JSON.stringify({ replies: editing }) },
      );
      setReplies(saved.replies);
      setEditing(null);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível salvar.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={styles.attach}
        aria-label="Respostas rápidas"
        disabled={disabled}
        onClick={() => {
          setEditing(null);
          setError(null);
          setOpen(true);
        }}
      >
        <svg
          viewBox="0 0 24 24"
          width="22"
          height="22"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />
        </svg>
      </button>
      {open
        ? createPortal(
            <Sheet
              open={open}
              onClose={() => setOpen(false)}
              title="Respostas rápidas"
              description={
                editing
                  ? "Uma por linha. Apague o texto para tirar."
                  : "Toque para colocar na mensagem."
              }
              footer={
                editing ? (
                  <Button
                    type="button"
                    block
                    disabled={busy}
                    onClick={() => void save()}
                  >
                    {busy ? "Salvando…" : "Salvar"}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    block
                    onClick={() => setEditing([...replies, ""])}
                  >
                    Editar
                  </Button>
                )
              }
            >
              {editing ? (
                <div className={styles.stack}>
                  {editing.map((reply, index) => (
                    <textarea
                      key={index}
                      className={styles.quickEdit}
                      aria-label={`Resposta ${index + 1}`}
                      rows={2}
                      maxLength={300}
                      value={reply}
                      placeholder="Nova resposta"
                      onChange={(event) =>
                        setEditing((current) =>
                          current!.map((item, i) =>
                            i === index ? event.target.value : item,
                          ),
                        )
                      }
                    />
                  ))}
                  {editing.length < 20 ? (
                    <Button
                      type="button"
                      variant="quiet"
                      onClick={() => setEditing((current) => [...current!, ""])}
                    >
                      Adicionar outra
                    </Button>
                  ) : null}
                  {error ? <FormAlert>{error}</FormAlert> : null}
                </div>
              ) : replies.length === 0 ? (
                <p className={styles.empty}>
                  Nenhuma ainda. Toque em Editar para criar.
                </p>
              ) : (
                <ul className={styles.quickList}>
                  {replies.map((reply) => (
                    <li key={reply}>
                      <button
                        type="button"
                        className={styles.quickItem}
                        onClick={() => {
                          onPick(reply);
                          setOpen(false);
                        }}
                      >
                        {reply}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Sheet>,
            document.body,
          )
        : null}
    </>
  );
}
