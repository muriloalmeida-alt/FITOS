"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ExperienceLevel, IndividualObjective, WeeklyAvailability } from "@prisma/client";
import { ActionRow, Avatar, Button, ChipGroup, FormAlert, Sheet, TextField, useToast } from "@/shared/ui";
import { NavIcon } from "@/shared/ui/NavIcon";
import { requestJson } from "../_workout-builder/apiClient";
import { AVAILABILITY_LABELS, EXPERIENCE_LABELS, OBJECTIVE_LABELS } from "../individualProfileLabels";
import { LogoutButton } from "../LogoutButton";
import styles from "./PersonalProfileView.module.css";

interface LivreProfileViewProps {
  name: string;
  email: string;
  spaceName: string;
  objective: IndividualObjective;
  experienceLevel: ExperienceLevel;
  weeklyAvailability: WeeklyAvailability;
  subscriptionSummary: string;
}

type SheetKind = null | "answers" | "space" | "name" | "email";
const options = <T extends string>(labels: Record<T, string>) => (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));

/// Perfil do FitOS Livre (FIT-160, L5 do protótipo): "Editar respostas" em
/// chips, assinatura com status, dados e nome do espaço, Termos e Sair.
export function LivreProfileView(props: LivreProfileViewProps) {
  const router = useRouter();
  const toast = useToast();
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [objective, setObjective] = useState(props.objective);
  const [experience, setExperience] = useState(props.experienceLevel);
  const [availability, setAvailability] = useState(props.weeklyAvailability);
  const [space, setSpace] = useState(props.spaceName);
  const [name, setName] = useState(props.name);
  const [email, setEmail] = useState(props.email);
  const [password, setPassword] = useState("");

  function open(kind: Exclude<SheetKind, null>) {
    setObjective(props.objective);
    setExperience(props.experienceLevel);
    setAvailability(props.weeklyAvailability);
    setSpace(props.spaceName);
    setName(props.name);
    setEmail(props.email);
    setPassword("");
    setError(null);
    setSheet(kind);
  }

  async function save(url: string, method: string, body: unknown, message: string) {
    setBusy(true);
    setError(null);
    try {
      await requestJson(url, { method, body: JSON.stringify(body) });
      toast.show(message);
      setSheet(null);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }

  const footer = (onSave: () => void, disabled = false) => (
    <>
      <Button type="button" block disabled={busy || disabled} onClick={onSave}>
        Salvar
      </Button>
      <Button type="button" variant="quiet" block onClick={() => setSheet(null)}>
        Agora não
      </Button>
    </>
  );
  const edit = (kind: Exclude<SheetKind, null>, label: string) => (
    <Button type="button" variant="quiet" aria-label={label} onClick={() => open(kind)}>
      Editar
    </Button>
  );

  return (
    <div className={styles.profile}>
      <div className={styles.identity}>
        <Avatar name={props.name} className={styles.avatar} />
        <div>
          <p className={styles.name}>{props.name}</p>
          <p className={styles.muted}>
            {props.spaceName} · {props.email}
          </p>
        </div>
      </div>

      <h2 className={styles.cap}>Seu treino</h2>
      <ActionRow
        title={OBJECTIVE_LABELS[props.objective]}
        description={`${EXPERIENCE_LABELS[props.experienceLevel]} · ${AVAILABILITY_LABELS[props.weeklyAvailability]}`}
        trailing={
          <Button type="button" variant="quiet" onClick={() => open("answers")}>
            Editar respostas
          </Button>
        }
      />

      <h2 className={styles.cap}>Assinatura</h2>
      <ActionRow href="/painel/assinatura" leading={<span className={styles.icon}><NavIcon name="assinatura" /></span>} title="Assinatura" description={props.subscriptionSummary} trailing={<span aria-hidden="true">›</span>} />

      <h2 className={styles.cap}>Seus dados</h2>
      <ul className={styles.list}>
        <li>
          <ActionRow title="Nome" description={props.name} trailing={edit("name", "Editar nome")} />
        </li>
        <li>
          <ActionRow title="E-mail de acesso" description={props.email} trailing={edit("email", "Editar e-mail")} />
        </li>
        <li>
          <ActionRow title="Nome do espaço" description={props.spaceName} trailing={edit("space", "Editar nome do espaço")} />
        </li>
      </ul>

      <h2 className={styles.cap}>Conta</h2>
      <ul className={styles.list}>
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

      <Sheet open={sheet === "answers"} onClose={() => setSheet(null)} title="Editar respostas" footer={footer(() => void save("/api/minha-conta/perfil-livre", "PATCH", { objective, experienceLevel: experience, weeklyAvailability: availability }, "Respostas salvas"))}>
        {error ? <FormAlert>{error}</FormAlert> : null}
        <div className={styles.stack}>
          <ChipGroup label="Objetivo" showLabel tone="accent" value={objective} onChange={setObjective} options={options(OBJECTIVE_LABELS)} />
          <ChipGroup label="Experiência" showLabel tone="accent" value={experience} onChange={setExperience} options={options(EXPERIENCE_LABELS)} />
          <ChipGroup label="Dias por semana" showLabel tone="accent" value={availability} onChange={setAvailability} options={options(AVAILABILITY_LABELS)} />
        </div>
      </Sheet>

      <Sheet open={sheet === "space"} onClose={() => setSheet(null)} title="Nome do espaço" footer={footer(() => void save("/api/minha-conta/perfil-livre", "PATCH", { spaceName: space }, "Nome do espaço salvo"))}>
        {error ? <FormAlert>{error}</FormAlert> : null}
        <TextField label="Nome do espaço" value={space} maxLength={80} onChange={(event) => setSpace(event.target.value)} />
      </Sheet>

      <Sheet open={sheet === "name"} onClose={() => setSheet(null)} title="Seu nome" footer={footer(() => void save("/api/minha-conta", "PATCH", { name }, "Nome salvo"))}>
        {error ? <FormAlert>{error}</FormAlert> : null}
        <TextField label="Nome" value={name} maxLength={120} autoComplete="name" onChange={(event) => setName(event.target.value)} />
      </Sheet>

      <Sheet open={sheet === "email"} onClose={() => setSheet(null)} title="E-mail de acesso" description="Você entra no FitOS com este e-mail. Confirme com sua senha." footer={footer(() => void save("/api/minha-conta/email", "POST", { email, password }, "E-mail atualizado"), password.length === 0)}>
        {error ? <FormAlert>{error}</FormAlert> : null}
        <div className={styles.stack}>
          <TextField label="Novo e-mail" type="email" inputMode="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          <TextField label="Senha atual" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </div>
      </Sheet>
    </div>
  );
}
