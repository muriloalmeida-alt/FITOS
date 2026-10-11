"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ChipGroup, FormAlert, useToast } from "@/shared/ui";
import { requestJson } from "../_workout-builder/apiClient";
import { ACTIVITY_LEVELS, EMPTY_HEALTH_ANSWERS, HEALTH_CONDITIONS, PARQ_QUESTIONS, type ActivityLevel, type HealthAnswers } from "@/shared/lib/healthForm";
import styles from "./Health.module.css";

/// Formulário da ficha de saúde (EPIC-46): PAR-Q em sim/não, condições,
/// lesões, remédios, dores e rotina. O aluno responde; o personal pode
/// preencher por ele.
export function HealthFormEditor({ initial, endpoint, doneHref, forStudent }: { initial: HealthAnswers | null; endpoint: string; doneHref: string; forStudent?: string }) {
  const router = useRouter();
  const toast = useToast();
  const [answers, setAnswers] = useState<HealthAnswers>(initial ?? EMPTY_HEALTH_ANSWERS);
  const [touched, setTouched] = useState<boolean[]>(() => PARQ_QUESTIONS.map(() => initial !== null));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof HealthAnswers>(key: K, value: HealthAnswers[K]) => setAnswers((current) => ({ ...current, [key]: value }));
  const you = forStudent ? `${forStudent.split(/\s+/)[0]}` : "Você";

  async function save() {
    if (touched.some((value) => !value)) {
      setError("Responda todas as perguntas de sim ou não.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await requestJson<{ parqYes: number }>(endpoint, { method: "PUT", body: JSON.stringify(answers) });
      toast.show(result.parqYes > 0 ? "Ficha salva. Vale conversar com um médico antes de pegar pesado." : "Ficha salva");
      router.push(doneHref);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar.");
      setBusy(false);
    }
  }

  return (
    <div className={styles.form}>
      <section className={styles.section}>
        <h2>Antes de começar</h2>
        <p className={styles.muted}>{forStudent ? `Respostas de ${forStudent}.` : "Leva 2 minutos. Só seu personal vê."}</p>
        <ol className={styles.parq}>
          {PARQ_QUESTIONS.map((question, index) => (
            <li key={question}>
              <p>{question}</p>
              <ChipGroup
                label={question}
                value={touched[index] ? (answers.parq[index] ? "sim" : "nao") : null}
                onChange={(value) => {
                  set("parq", answers.parq.map((current, i) => (i === index ? value === "sim" : current)));
                  setTouched((current) => current.map((done, i) => (i === index ? true : done)));
                }}
                options={[
                  { value: "nao", label: "Não" },
                  { value: "sim", label: "Sim" },
                ]}
              />
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.section}>
        <h2>Saúde</h2>
        <ChipGroup label={`${you} tem algum destes?`} showLabel multiple value={answers.conditions} onChange={(value) => set("conditions", value)} options={HEALTH_CONDITIONS.map((item) => ({ value: item.key, label: item.label }))} />
        <label className={styles.field}>
          <span>Lesões ou cirurgias</span>
          <textarea rows={2} maxLength={1000} value={answers.injuries} placeholder="Ex.: cirurgia no joelho em 2022" onChange={(event) => set("injuries", event.target.value)} />
        </label>
        <label className={styles.field}>
          <span>Remédios de uso contínuo</span>
          <textarea rows={2} maxLength={1000} value={answers.medications} onChange={(event) => set("medications", event.target.value)} />
        </label>
        <label className={styles.field}>
          <span>Alguma dor hoje?</span>
          <textarea rows={2} maxLength={1000} value={answers.pain} placeholder="Onde e quando aparece" onChange={(event) => set("pain", event.target.value)} />
        </label>
      </section>

      <section className={styles.section}>
        <h2>Rotina</h2>
        <ChipGroup label="Exercício hoje" showLabel variant="card" columns={1} value={answers.activity} onChange={(value: ActivityLevel) => set("activity", value)} options={ACTIVITY_LEVELS.map((item) => ({ value: item.key, label: item.label }))} />
        <label className={styles.field}>
          <span>Algo mais que o personal deva saber?</span>
          <textarea rows={2} maxLength={1000} value={answers.notes} onChange={(event) => set("notes", event.target.value)} />
        </label>
      </section>

      {error ? <FormAlert>{error}</FormAlert> : null}
      <Button type="button" block disabled={busy || !answers.activity} onClick={() => void save()}>
        {busy ? "Salvando…" : "Salvar ficha"}
      </Button>
    </div>
  );
}
