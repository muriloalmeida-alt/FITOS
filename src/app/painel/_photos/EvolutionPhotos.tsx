"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, FormAlert, Sheet, useToast } from "@/shared/ui";
import { resizeImage } from "@/shared/lib/resizeImage";
import { requestJson } from "../_workout-builder/apiClient";
import { CameraIcon } from "./AvatarPicker";
import { uploadForm } from "./upload";
import styles from "./Photos.module.css";

export type PhotoPose = "FRENTE" | "LADO" | "COSTAS";
export interface EvolutionPhotoItem {
  id: string;
  pose: PhotoPose;
  takenIso: string;
}

/// De quem são as fotos: a própria pessoa (aluno ou Livre) ou um aluno do
/// personal. `audience` completa "Só você … veem".
export type PhotoOwner = { kind: "self"; audience: string } | { kind: "personal"; studentId: string; firstName: string };

const POSES: { key: PhotoPose; label: string }[] = [
  { key: "FRENTE", label: "Frente" },
  { key: "LADO", label: "Lado" },
  { key: "COSTAS", label: "Costas" },
];
const poseLabel = (pose: PhotoPose) => POSES.find((entry) => entry.key === pose)?.label ?? pose;
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" });
const dayLabel = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Sao_Paulo" });
const src = (id: string) => `/api/fotos-evolucao/${id}`;

type SheetState = null | "consent" | "pose" | "revoke" | { photo: EvolutionPhotoItem };

/// Fotos da avaliação (EPIC-35): frente, lado e costas por data, "antes e
/// agora" lado a lado, e a autorização explícita do aluno antes da primeira
/// foto (REGRAS-DE-NEGOCIO seção 7). Reduzidas no aparelho antes de subir.
export function EvolutionPhotos({ photos, consent, owner }: { photos: EvolutionPhotoItem[]; consent: boolean; owner: PhotoOwner }) {
  const router = useRouter();
  const toast = useToast();
  const [sheet, setSheet] = useState<SheetState>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const studentBody = owner.kind === "personal" ? { aluno: owner.studentId } : {};

  async function run(action: () => Promise<unknown>, message: string, next: SheetState = null) {
    setBusy(true);
    setError(null);
    try {
      await action();
      toast.show(message);
      setSheet(next);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }

  function openSheet(next: SheetState) {
    setError(null);
    setSheet(next);
  }

  function onFile(pose: PhotoPose, file: File | undefined) {
    if (!file) return;
    void run(async () => {
      const { blob, width, height } = await resizeImage(file, { max: 1600, quality: 0.82 });
      const form = new FormData();
      form.append("foto", blob, "foto.jpg");
      form.append("pose", pose);
      form.append("largura", String(width));
      form.append("altura", String(height));
      if (owner.kind === "personal") form.append("aluno", owner.studentId);
      await uploadForm("/api/fotos-evolucao", form);
    }, `${poseLabel(pose)} salva`);
  }

  const groups: { key: string; label: string; photos: EvolutionPhotoItem[] }[] = [];
  for (const photo of photos) {
    const key = dayKey.format(new Date(photo.takenIso));
    const group = groups.find((entry) => entry.key === key);
    if (group) group.photos.push(photo);
    else groups.push({ key, label: dayLabel.format(new Date(photo.takenIso)), photos: [photo] });
  }
  for (const group of groups) group.photos.sort((a, b) => POSES.findIndex((p) => p.key === a.pose) - POSES.findIndex((p) => p.key === b.pose));

  // Antes e agora: por pose, a foto mais antiga e a mais recente, se forem de dias diferentes.
  const pairs = POSES.flatMap(({ key }) => {
    const ofPose = photos.filter((photo) => photo.pose === key);
    const latest = ofPose[0];
    const earliest = ofPose[ofPose.length - 1];
    if (!latest || !earliest || dayKey.format(new Date(latest.takenIso)) === dayKey.format(new Date(earliest.takenIso))) return [];
    return [{ pose: key, before: earliest, after: latest }];
  });

  const first = owner.kind === "personal" ? owner.firstName : null;

  return (
    <section className={styles.photos} aria-labelledby="fotos-avaliacao">
      <div className={styles.photosHead}>
        <h2 id="fotos-avaliacao" className={styles.title}>
          Fotos
        </h2>
        {photos.length > 0 ? (
          <Button type="button" variant="quiet" onClick={() => openSheet(consent ? "pose" : "consent")}>
            Adicionar
          </Button>
        ) : null}
      </div>

      {photos.length === 0 ? (
        <button type="button" className={styles.emptyCard} onClick={() => openSheet(consent ? "pose" : "consent")}>
          <span className={styles.emptyIcon} aria-hidden="true">
            <CameraIcon />
          </span>
          <span>
            <strong>Adicionar fotos</strong>
            <span className={styles.muted}>Frente, lado e costas mostram o que a balança não mostra.</span>
          </span>
        </button>
      ) : null}

      {pairs.length > 0 ? (
        <div className={styles.compare}>
          <h3 className={styles.subtitle}>Antes e agora</h3>
          {pairs.map((pair) => (
            <div key={pair.pose} className={styles.pair}>
              {[pair.before, pair.after].map((photo) => (
                <button key={photo.id} type="button" className={styles.pairItem} onClick={() => openSheet({ photo })} aria-label={`${poseLabel(photo.pose)} em ${dayLabel.format(new Date(photo.takenIso))}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- foto privada, servida por rota autenticada (EPIC-35) */}
                  <img src={src(photo.id)} alt="" loading="lazy" className={styles.pairImage} />
                  <span className={styles.caption}>
                    {poseLabel(photo.pose)} · {dayLabel.format(new Date(photo.takenIso))}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      ) : null}

      {groups.map((group) => (
        <div key={group.key} className={styles.group}>
          <h3 className={styles.subtitle}>{group.label}</h3>
          <ul className={styles.grid}>
            {group.photos.map((photo) => (
              <li key={photo.id}>
                <button type="button" className={styles.thumb} onClick={() => openSheet({ photo })} aria-label={`${poseLabel(photo.pose)} em ${group.label}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- foto privada, servida por rota autenticada (EPIC-35) */}
                  <img src={src(photo.id)} alt="" loading="lazy" className={styles.thumbImage} />
                  <span className={styles.caption}>{poseLabel(photo.pose)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {owner.kind === "self" && consent ? (
        <Button type="button" variant="quiet" onClick={() => openSheet("revoke")}>
          Retirar autorização das fotos
        </Button>
      ) : null}

      <Sheet
        open={sheet === "consent"}
        onClose={() => setSheet(null)}
        title={first ? `Fotos de ${first}` : "Suas fotos, só suas"}
        description={
          first
            ? `Antes de fotografar, peça a autorização de ${first}. As fotos ficam visíveis só para vocês dois, e ${first} pode apagá-las quando quiser.`
            : `Só ${owner.kind === "self" ? owner.audience : "você"} veem. Você pode apagar tudo quando quiser.`
        }
        footer={
          <Button type="button" block disabled={busy} onClick={() => void run(() => requestJson("/api/fotos-evolucao/autorizacao", { method: "POST", body: JSON.stringify(studentBody) }), "Autorização registrada", "pose")}>
            {first ? `${first} autorizou` : "Autorizo"}
          </Button>
        }
      >
        {error ? <FormAlert>{error}</FormAlert> : null}
      </Sheet>

      <Sheet open={sheet === "pose"} onClose={() => setSheet(null)} title="Qual foto?" description="Corpo inteiro, de frente para a câmera, com boa luz.">
        <div className={styles.poses}>
          {POSES.map((pose) => (
            <label key={pose.key} className={busy ? `${styles.fileButton} ${styles.fileButtonBusy}` : styles.fileButton}>
              {pose.label}
              <input type="file" accept="image/*" className={styles.fileInput} disabled={busy} onChange={(event) => { onFile(pose.key, event.target.files?.[0]); event.target.value = ""; }} />
            </label>
          ))}
        </div>
        {busy ? <p className={styles.muted}>Enviando…</p> : null}
        {error ? <FormAlert>{error}</FormAlert> : null}
      </Sheet>

      <Sheet
        open={typeof sheet === "object" && sheet !== null}
        onClose={() => setSheet(null)}
        title={typeof sheet === "object" && sheet ? `${poseLabel(sheet.photo.pose)} · ${dayLabel.format(new Date(sheet.photo.takenIso))}` : "Foto"}
        footer={
          typeof sheet === "object" && sheet ? (
            <Button type="button" variant="quiet" block disabled={busy} onClick={() => void run(() => requestJson(src(sheet.photo.id), { method: "DELETE" }), "Foto excluída")}>
              Excluir foto
            </Button>
          ) : null
        }
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- foto privada, servida por rota autenticada (EPIC-35) */}
        {typeof sheet === "object" && sheet ? <img src={src(sheet.photo.id)} alt={`${poseLabel(sheet.photo.pose)}`} className={styles.large} /> : null}
        {error ? <FormAlert>{error}</FormAlert> : null}
      </Sheet>

      <Sheet
        open={sheet === "revoke"}
        onClose={() => setSheet(null)}
        title="Apagar todas as fotos?"
        description="Sem a sua autorização, nenhuma foto fica guardada. Isso não pode ser desfeito."
        footer={
          <Button type="button" block disabled={busy} onClick={() => void run(() => requestJson("/api/fotos-evolucao/autorizacao", { method: "DELETE", body: JSON.stringify(studentBody) }), "Fotos apagadas")}>
            Apagar fotos
          </Button>
        }
      >
        {error ? <FormAlert>{error}</FormAlert> : null}
      </Sheet>
    </section>
  );
}
