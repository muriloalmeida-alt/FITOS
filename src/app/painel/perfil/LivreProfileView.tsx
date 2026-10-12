"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ExperienceLevel, IndividualObjective, WeeklyAvailability } from "@prisma/client";
import { ChipGroup, FormAlert, Button, useToast } from "@/shared/ui";
import { AVAILABILITY_LABELS, EXPERIENCE_LABELS, OBJECTIVE_LABELS } from "../individualProfileLabels";
import { LogoutButton } from "../LogoutButton";
import { BiometricSwitch } from "./BiometricSwitch";
import { MyDataRow, ProfileGroup, ProfileHeader, ProfileRow, SheetRow, TermsRow, sendJson } from "./ProfileParts";
import { RoutineRows, type RoutinePreferences } from "./RoutineRows";
import { ModalitiesEditor } from "./ModalitiesEditor";
import { modalitiesLabel, type Modality } from "@/shared/lib/modalities";
import styles from "./ProfileParts.module.css";

interface LivreProfileViewProps {
  name: string;
  /// Foto de perfil (EPIC-35).
  image: string | null;
  email: string;
  spaceName: string;
  objective: IndividualObjective;
  experienceLevel: ExperienceLevel;
  weeklyAvailability: WeeklyAvailability;
  subscriptionSummary: string;
  /// Modalidades (proposta 11); vazio = ainda não definidas.
  modalities: Modality[];
  /// Lembrete de treino e dias de treino (EPIC-31).
  preferences: RoutinePreferences;
}

const options = <T extends string>(labels: Record<T, string>) => (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));

/// Perfil do FitOS Livre (proposta 10): identidade, "Treino e rotina"
/// (Meu treino, Dias, Lembrete) e "Conta" (Meus dados, Minha assinatura,
/// biometria, Termos e privacidade), com Sair ao final.
export function LivreProfileView(props: LivreProfileViewProps) {
  const router = useRouter();
  const toast = useToast();
  const [objective, setObjective] = useState(props.objective);
  const [experience, setExperience] = useState(props.experienceLevel);
  const [availability, setAvailability] = useState(props.weeklyAvailability);
  const [error, setError] = useState<string | null>(null);

  // Respostas: cada toque salva na hora; erro volta ao valor anterior.
  function answer<T>(patch: Record<string, string>, previous: T, restore: (value: T) => void) {
    setError(null);
    void sendJson("/api/minha-conta/perfil-livre", "PATCH", patch)
      .then(() => {
        toast.show("Salvo");
        router.refresh();
      })
      .catch((cause) => {
        restore(previous);
        setError(cause instanceof Error ? cause.message : "Não foi possível salvar.");
      });
  }

  return (
    <div className={styles.profile}>
      <ProfileHeader name={props.name} image={props.image} email={props.email} badge="FitOS Livre" />

      <ProfileGroup title="Treino e rotina">
        <SheetRow
          icon="treino"
          title="Meu treino"
          summary={`${props.modalities.length > 0 ? `${modalitiesLabel(props.modalities)} · ` : ""}${OBJECTIVE_LABELS[objective]} · ${EXPERIENCE_LABELS[experience]} · ${AVAILABILITY_LABELS[availability]}`}
          footer={(close) => (
            <Button type="button" block onClick={close}>
              Pronto
            </Button>
          )}
        >
          <div className={styles.form}>
          <ModalitiesEditor value={props.modalities} note="Muda as próximas recomendações; seus treinos e programa continuam como estão." />
          <div className={styles.form} role="group" aria-label="Suas respostas">
            <ChipGroup label="Objetivo" showLabel tone="accent" value={objective} onChange={(value) => { const previous = objective; setObjective(value); answer({ objective: value }, previous, setObjective); }} options={options(OBJECTIVE_LABELS)} />
            <ChipGroup label="Experiência" showLabel tone="accent" value={experience} onChange={(value) => { const previous = experience; setExperience(value); answer({ experienceLevel: value }, previous, setExperience); }} options={options(EXPERIENCE_LABELS)} />
            <ChipGroup label="Dias por semana" showLabel tone="accent" value={availability} onChange={(value) => { const previous = availability; setAvailability(value); answer({ weeklyAvailability: value }, previous, setAvailability); }} options={options(AVAILABILITY_LABELS)} />
            <p className={styles.note}>Mudar as respostas não altera os seus treinos e programas.</p>
            {error ? <FormAlert>{error}</FormAlert> : null}
          </div>
          </div>
        </SheetRow>
        <RoutineRows {...props.preferences} />
      </ProfileGroup>

      <ProfileGroup title="Conta">
        <MyDataRow
          summary="Nome, e-mail e nome do espaço"
          fields={[
            { key: "name", title: "Nome", value: props.name, inputs: [{ name: "name", label: "Nome", autoComplete: "name", maxLength: 120 }], initial: { name: props.name }, save: (values) => sendJson("/api/minha-conta", "PATCH", { name: values.name }), message: "Nome salvo" },
            {
              key: "email",
              title: "E-mail de acesso",
              value: props.email,
              inputs: [
                { name: "email", label: "Novo e-mail", type: "email", autoComplete: "email" },
                { name: "password", label: "Senha atual", type: "password", autoComplete: "current-password" },
              ],
              initial: { email: props.email, password: "" },
              save: (values) => sendJson("/api/minha-conta/email", "POST", { email: values.email, password: values.password }),
              message: "E-mail atualizado",
            },
            { key: "space", title: "Nome do espaço", value: props.spaceName, inputs: [{ name: "spaceName", label: "Nome do espaço", maxLength: 80 }], initial: { spaceName: props.spaceName }, save: (values) => sendJson("/api/minha-conta/perfil-livre", "PATCH", { spaceName: values.spaceName }), message: "Nome do espaço salvo" },
          ]}
        />
        <ProfileRow icon="assinatura" title="Minha assinatura" summary={props.subscriptionSummary} href="/painel/assinatura" />
        <BiometricSwitch />
        <TermsRow />
      </ProfileGroup>

      <div className={styles.logout}>
        <LogoutButton block label="Sair da conta" />
      </div>
    </div>
  );
}
