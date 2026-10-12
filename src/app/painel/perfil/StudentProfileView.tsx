"use client";

import { ShareLinkButton } from "../_share/ShareLinkButton";
import { ActionRow, Avatar } from "@/shared/ui";
import { LogoutButton } from "../LogoutButton";
import { BiometricSwitch } from "./BiometricSwitch";
import { MyDataRow, ProfileGroup, ProfileHeader, ProfileRow, SheetRow, TermsRow, sendJson } from "./ProfileParts";
import { RoutineRows, type RoutinePreferences } from "./RoutineRows";
import styles from "./ProfileParts.module.css";

interface StudentProfileViewProps {
  name: string;
  /// Foto de perfil (EPIC-35).
  image: string | null;
  email: string;
  coach: { name: string; image: string | null; businessName: string; cref: string | null };
  /// Lembrete de treino e dias de treino (EPIC-31).
  preferences: RoutinePreferences;
  /// Indicação (EPIC-47): link do personal com o aluno como quem indicou.
  invitePath?: string | null;
}

/// Perfil do Aluno com personal (proposta 10): o mesmo desenho do Livre,
/// com as opções do aluno. Sem assinatura própria (o FitOS não cobra o
/// aluno) e sem editar o espaço do personal.
export function StudentProfileView({ name, image, email, coach, preferences, invitePath = null }: StudentProfileViewProps) {
  const coachFirst = coach.name.split(/\s+/)[0] ?? coach.name;

  return (
    <div className={styles.profile}>
      <ProfileHeader name={name} image={image} email={email} badge={`Aluno de ${coachFirst}`} />

      <ProfileGroup title="Treino e rotina">
        <SheetRow icon="personal" title="Meu personal" summary={coach.name} sheetTitle="Seu personal">
          <div className={styles.form}>
            <ActionRow leading={<Avatar name={coach.name} src={coach.image} />} title={coach.name} description={[coach.businessName, coach.cref ? `CREF ${coach.cref}` : null].filter(Boolean).join(" · ")} />
            <p className={styles.note}>Mensalidade e programa são combinados direto com {coachFirst}. O FitOS não cobra você.</p>
            {invitePath ? (
              <ActionRow
                title={`Indique um amigo para ${coachFirst}`}
                description="Quem entrar pelo seu link aparece como sua indicação."
                trailing={<ShareLinkButton path={invitePath} text={`Treino com ${coachFirst} pelo FitOS. Entra por aqui:`} />}
              />
            ) : null}
          </div>
        </SheetRow>
        <RoutineRows {...preferences} />
        <ProfileRow icon="saude" title="Ficha de saúde" summary="Anamnese e PAR-Q, só seu personal vê" href="/painel/saude" />
      </ProfileGroup>

      <ProfileGroup title="Conta">
        <MyDataRow
          summary="Nome e e-mail"
          fields={[
            { key: "name", title: "Nome", value: name, hint: `${coachFirst} também vê este nome.`, inputs: [{ name: "name", label: "Nome", autoComplete: "name", maxLength: 120 }], initial: { name }, save: (values) => sendJson("/api/minha-conta", "PATCH", { name: values.name }), message: "Nome salvo" },
            {
              key: "email",
              title: "E-mail de acesso",
              value: email,
              inputs: [
                { name: "email", label: "Novo e-mail", type: "email", autoComplete: "email" },
                { name: "password", label: "Senha atual", type: "password", autoComplete: "current-password" },
              ],
              initial: { email, password: "" },
              save: (values) => sendJson("/api/minha-conta/email", "POST", { email: values.email, password: values.password }),
              message: "E-mail atualizado",
            },
          ]}
        />
        <BiometricSwitch />
        <TermsRow />
      </ProfileGroup>

      <div className={styles.logout}>
        <LogoutButton block label="Sair da conta" />
      </div>
    </div>
  );
}
