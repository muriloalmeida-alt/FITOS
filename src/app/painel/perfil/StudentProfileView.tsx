"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShareLinkButton } from "../_share/ShareLinkButton";
import { ActionRow, Avatar, Button, FormAlert, TextField, useToast } from "@/shared/ui";
import { requestJson } from "../_workout-builder/apiClient";
import { LogoutButton } from "../LogoutButton";
import { TrainingPreferences } from "../_push/TrainingPreferences";
import { PasskeyRow } from "../_push/PasskeyRow";
import { AvatarPicker } from "../_photos/AvatarPicker";
import styles from "./PersonalProfileView.module.css";

interface StudentProfileViewProps {
  name: string;
  /// Foto de perfil (EPIC-35).
  image: string | null;
  email: string;
  coach: { name: string; image: string | null; businessName: string; cref: string | null };
  /// Lembrete de treino e "Meus dias" (EPIC-31).
  preferences: Parameters<typeof TrainingPreferences>[0];
  /// Indicação (EPIC-47): link do personal com o aluno como quem indicou.
  invitePath?: string | null;
}

/// Perfil do Aluno (FIT-155, A5 do protótipo): quem é o personal, nome e
/// e-mail editáveis no próprio lugar (EPIC-30), Termos, Privacidade e Sair.
export function StudentProfileView({ name, image, email, coach, preferences, invitePath = null }: StudentProfileViewProps) {
  const router = useRouter();
  const toast = useToast();
  const [sheet, setSheet] = useState<null | "name" | "email">(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftName, setDraftName] = useState(name);
  const [draftEmail, setDraftEmail] = useState(email);
  const [password, setPassword] = useState("");
  const coachFirst = coach.name.split(/\s+/)[0] ?? coach.name;

  function open(kind: "name" | "email") {
    setDraftName(name);
    setDraftEmail(email);
    setPassword("");
    setError(null);
    setSheet(kind);
  }

  async function run(action: () => Promise<void>, message: string) {
    setBusy(true);
    setError(null);
    try {
      await action();
      toast.show(message);
      setSheet(null);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.profile}>
      <div className={styles.identity}>
        <AvatarPicker name={name} image={image} />
        <div>
          <p className={styles.name}>{name}</p>
          <p className={styles.muted}>{email}</p>
        </div>
      </div>

      <h2 className={styles.cap}>Preferências</h2>
      <TrainingPreferences {...preferences} />

      <h2 className={styles.cap}>Seu personal</h2>
      <ActionRow leading={<Avatar name={coach.name} src={coach.image} />} title={coach.name} description={[coach.businessName, coach.cref ? `CREF ${coach.cref}` : null].filter(Boolean).join(" · ")} />
      <p className={styles.muted}>Mensalidade e programa são combinados direto com {coachFirst}. O FitOS não cobra você.</p>
      {invitePath ? (
        <ActionRow
          title={`Indique um amigo para ${coachFirst}`}
          description="Quem entrar pelo seu link aparece como sua indicação."
          trailing={<ShareLinkButton path={invitePath} text={`Treino com ${coachFirst} pelo FitOS. Entra por aqui:`} />}
        />
      ) : null}

      <h2 className={styles.cap}>Seus dados</h2>
      <ul className={styles.list}>
        <li>
          {sheet === "name" ? (
            <div className={styles.inline} role="group" aria-label="Seu nome">
              <TextField label="Nome" value={draftName} maxLength={120} autoComplete="name" autoFocus onChange={(event) => setDraftName(event.target.value)} />
              <p className={styles.muted}>{coachFirst} também vê este nome.</p>
              {error ? <FormAlert>{error}</FormAlert> : null}
              <div className={styles.inlineActions}>
                <Button type="button" disabled={busy || draftName.trim().length === 0} onClick={() => void run(() => requestJson("/api/minha-conta", { method: "PATCH", body: JSON.stringify({ name: draftName }) }).then(() => undefined), "Nome salvo")}>
                  Salvar
                </Button>
                <Button type="button" variant="quiet" onClick={() => setSheet(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <ActionRow title="Nome" description={name} trailing={<Button type="button" variant="quiet" aria-label="Editar nome" onClick={() => open("name")}>Editar</Button>} />
          )}
        </li>
        <li>
          {sheet === "email" ? (
            <div className={styles.inline} role="group" aria-label="E-mail de acesso">
              <TextField label="Novo e-mail" type="email" inputMode="email" autoComplete="email" autoFocus value={draftEmail} onChange={(event) => setDraftEmail(event.target.value)} />
              <TextField label="Senha atual" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
              {error ? <FormAlert>{error}</FormAlert> : null}
              <div className={styles.inlineActions}>
                <Button type="button" disabled={busy || password.length === 0} onClick={() => void run(() => requestJson("/api/minha-conta/email", { method: "POST", body: JSON.stringify({ email: draftEmail, password }) }).then(() => undefined), "E-mail atualizado")}>
                  Salvar
                </Button>
                <Button type="button" variant="quiet" onClick={() => setSheet(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <ActionRow title="E-mail de acesso" description={email} trailing={<Button type="button" variant="quiet" aria-label="Editar e-mail" onClick={() => open("email")}>Editar</Button>} />
          )}
        </li>
      </ul>

      <h2 className={styles.cap}>Conta</h2>
      <ul className={styles.list}>
        <li>
          <PasskeyRow />
        </li>
        <li>
          <ActionRow href="/painel/saude" title="Ficha de saúde" description="Anamnese e PAR-Q, só seu personal vê" trailing={<span aria-hidden="true">›</span>} />
        </li>
        <li>
          <ActionRow href="/termos-de-uso" title="Termos de uso" trailing={<span aria-hidden="true">›</span>} />
        </li>
        <li>
          <ActionRow href="/politica-de-privacidade" title="Política de privacidade" trailing={<span aria-hidden="true">›</span>} />
        </li>
      </ul>
      <div className={styles.logout}>
        <LogoutButton block />
      </div>

    </div>
  );
}
