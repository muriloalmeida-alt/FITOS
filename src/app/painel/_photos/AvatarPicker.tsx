"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, Button, FormAlert, Sheet, useToast } from "@/shared/ui";
import { resizeImage } from "@/shared/lib/resizeImage";
import { requestJson } from "../_workout-builder/apiClient";
import { uploadForm } from "./upload";
import styles from "./Photos.module.css";

/// Foto de perfil (EPIC-35): toque no avatar, escolha ou tire a foto. Ela
/// é recortada quadrada e reduzida no aparelho antes de subir.
export function AvatarPicker({ name, image }: { name: string; image: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError(null);
    try {
      await action();
      toast.show(message);
      setOpen(false);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }

  function onFile(file: File | undefined) {
    if (!file) return;
    void run(async () => {
      const { blob } = await resizeImage(file, { max: 512, square: true });
      const form = new FormData();
      form.append("foto", blob, "avatar.jpg");
      await uploadForm("/api/meu-avatar", form);
    }, "Foto atualizada");
  }

  return (
    <>
      <button type="button" className={styles.avatarButton} aria-label={image ? "Trocar foto de perfil" : "Adicionar foto de perfil"} onClick={() => { setError(null); setOpen(true); }}>
        <Avatar name={name} src={image} className={styles.avatar} />
        <span className={styles.avatarBadge} aria-hidden="true">
          <CameraIcon />
        </span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Foto de perfil" description="Aparece para você e para quem treina com você.">
        <div className={styles.stack}>
          <label className={busy ? `${styles.fileButton} ${styles.fileButtonBusy}` : styles.fileButton}>
            {busy ? "Enviando…" : image ? "Escolher outra foto" : "Escolher foto"}
            <input type="file" accept="image/*" className={styles.fileInput} disabled={busy} onChange={(event) => { onFile(event.target.files?.[0]); event.target.value = ""; }} />
          </label>
          {image ? (
            <Button type="button" variant="quiet" block disabled={busy} onClick={() => void run(() => requestJson("/api/meu-avatar", { method: "DELETE" }), "Foto removida")}>
              Remover foto
            </Button>
          ) : null}
          {error ? <FormAlert>{error}</FormAlert> : null}
        </div>
      </Sheet>
    </>
  );
}

export function CameraIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13.5" r="3.5" />
    </svg>
  );
}
