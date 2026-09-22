"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, FormAlert } from "@/shared/ui";
import styles from "./PlanoDoAlunoSection.module.css";

export interface ActiveAssignmentProp {
  planName: string;
  assignedAt: string;
}

export interface AvailablePlanOption {
  id: string;
  name: string;
}

interface PlanoDoAlunoSectionProps {
  studentId: string;
  activeAssignment: ActiveAssignmentProp | null;
  hasEndedAssignments: boolean;
  availablePlans: AvailablePlanOption[];
  podeAtribuir: boolean;
}

/// Gestão da atribuição de plano ao aluno, do ponto de vista do personal
/// (FIT-033). Três estados possíveis: sem plano (nunca teve nenhuma
/// atribuição), plano ativo (`activeAssignment` presente) e plano
/// encerrado (nenhuma ativa, mas `hasEndedAssignments`) — atribuir um novo
/// plano funciona igual nos três casos, sempre encerrando controladamente
/// a anterior, se houver (`assignTrainingPlanToStudent`).
///
/// `podeAtribuir` (FIT-108, `status === "ATIVO"`) esconde o formulário de
/// atribuir/trocar e o botão de encerrar atribuição — nunca a leitura do
/// programa já atribuído, que a FIT-107 já garante permanecer visível.
/// `assignTrainingPlanToStudent`/`unassignTrainingPlanFromStudent`
/// (backend) já rejeitam essas ações para um aluno não `ATIVO`; esconder
/// o formulário aqui evita que o personal tente e receba um erro confuso.
export function PlanoDoAlunoSection({ studentId, activeAssignment, hasEndedAssignments, availablePlans, podeAtribuir }: PlanoDoAlunoSectionProps) {
  const router = useRouter();
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [endError, setEndError] = useState<string | null>(null);

  async function handleAssignSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }
    if (!selectedPlanId) {
      setFormError("Selecione um programa.");
      return;
    }
    setFormError(null);
    setIsSubmitting(true);

    const response = await fetch(`/api/students/${studentId}/plano`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trainingPlanId: selectedPlanId }),
    });
    setIsSubmitting(false);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setFormError(body?.message ?? "Não foi possível atribuir o programa. Tente novamente.");
      return;
    }

    setSelectedPlanId("");
    router.refresh();
  }

  async function handleEnd() {
    if (isEnding) {
      return;
    }
    setEndError(null);
    setIsEnding(true);
    const response = await fetch(`/api/students/${studentId}/plano`, { method: "DELETE" });
    setIsEnding(false);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setEndError(body?.message ?? "Não foi possível encerrar a atribuição. Tente novamente.");
      return;
    }
    router.refresh();
  }

  return (
    <div className={styles.container}>
      {activeAssignment ? (
        <div className={styles.activeCard}>
          <p className={styles.planName}>{activeAssignment.planName}</p>
          <p className={styles.assignedSince}>
            Atribuído em {new Date(activeAssignment.assignedAt).toLocaleDateString("pt-BR")}
          </p>
          {podeAtribuir ? (
            <>
              {endError ? <FormAlert variant="error">{endError}</FormAlert> : null}
              <div className={styles.actions}>
                <Button type="button" variant="outlined" onClick={handleEnd} disabled={isEnding}>
                  {isEnding ? "Encerrando…" : "Encerrar atribuição"}
                </Button>
              </div>
            </>
          ) : null}
        </div>
      ) : (
        <p className={styles.empty}>
          {hasEndedAssignments ? "Nenhum programa ativo atualmente." : "Nenhum programa atribuído ainda."}
        </p>
      )}

      {podeAtribuir ? (
        <form className={styles.form} onSubmit={handleAssignSubmit} noValidate>
          <h3 className={styles.formTitle}>{activeAssignment ? "Trocar programa" : "Atribuir programa"}</h3>
          {formError ? <FormAlert variant="error">{formError}</FormAlert> : null}

          {availablePlans.length === 0 ? (
            <p className={styles.empty}>Nenhum programa disponível para atribuir ainda.</p>
          ) : (
            <>
              <div className={styles.selectField}>
                <label className={styles.selectLabel} htmlFor="trainingPlanId">
                  Programa
                </label>
                <select
                  id="trainingPlanId"
                  className={styles.select}
                  value={selectedPlanId}
                  onChange={(event) => setSelectedPlanId(event.target.value)}
                  disabled={isSubmitting}
                >
                  <option value="">Selecione um programa</option>
                  {availablePlans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" variant="filled" disabled={isSubmitting}>
                {isSubmitting ? "Atribuindo…" : "Atribuir programa"}
              </Button>
            </>
          )}
        </form>
      ) : null}
    </div>
  );
}
