"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PersonalStudentRangeEstimate } from "@prisma/client";
import { ActionRow, Button, ChipGroup, FormAlert, Sheet, TextField, useToast } from "@/shared/ui";
import { NavIcon } from "@/shared/ui/NavIcon";
import { formatBrazilianPhone } from "@/shared/lib/brazilianPhone";
import { STUDENT_RANGE_OPTIONS, studentRangeLabel } from "@/modules/personal-onboarding/studentRangeLabel";
import { requestJson } from "../_workout-builder/apiClient";
import { LogoutButton } from "../LogoutButton";
import { PushDeviceRow } from "../_push/PushDeviceRow";
import { PasskeyRow } from "../_push/PasskeyRow";
import { AvatarPicker } from "../_photos/AvatarPicker";
import styles from "./PersonalProfileView.module.css";

interface PersonalProfileViewProps {
  name: string;
  /// Foto de perfil (EPIC-35).
  image: string | null;
  email: string;
  businessName: string;
  phone: string | null;
  cref: string | null;
  studentRange: PersonalStudentRangeEstimate;
  /// "Seu negócio": resumos já formatados no servidor.
  financeSummary: string;
  subscriptionSummary: string;
  exercisesSummary: string;
}

type SheetKind = null | "business" | "professional" | "personal";

/// Perfil do Personal (FIT-149, P7 do protótipo): "Seu negócio"
/// (Financeiro, Assinatura e Exercícios, no lugar do menu do avatar),
/// dados editáveis em sheets, Termos, Privacidade e Sair.
export function PersonalProfileView(props: PersonalProfileViewProps) {
  const router = useRouter();
  const toast = useToast();
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState(props.businessName);
  const [phone, setPhone] = useState(formatBrazilianPhone(props.phone ?? ""));
  const [cref, setCref] = useState(props.cref ?? "");
  const [range, setRange] = useState<PersonalStudentRangeEstimate>(props.studentRange);
  const [name, setName] = useState(props.name);

  function open(kind: Exclude<SheetKind, null>) {
    setBusinessName(props.businessName);
    setPhone(formatBrazilianPhone(props.phone ?? ""));
    setCref(props.cref ?? "");
    setRange(props.studentRange);
    setName(props.name);
    setError(null);
    setSheet(kind);
  }

  async function save(body: Record<string, string>, message: string) {
    setBusy(true);
    setError(null);
    try {
      await requestJson("/api/tenancy/meu-tenant", { method: "PATCH", body: JSON.stringify(body) });
      toast.show(message);
      setSheet(null);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }

  const footer = (onSave: () => void) => (
    <>
      <Button type="button" block disabled={busy} onClick={onSave}>
        Salvar
      </Button>
      <Button type="button" variant="quiet" block onClick={() => setSheet(null)}>
        Agora não
      </Button>
    </>
  );
  const edit = (kind: Exclude<SheetKind, null>, label: string) => (
    <Button type="button" variant="quiet" onClick={() => open(kind)} aria-label={label}>
      Editar
    </Button>
  );

  return (
    <div className={styles.profile}>
      <div className={styles.identity}>
        <AvatarPicker name={props.name} image={props.image} />
        <div>
          <p className={styles.name}>{props.name}</p>
          <p className={styles.muted}>
            {props.businessName} · {props.email}
          </p>
        </div>
      </div>

      <h2 className={styles.cap}>Seu negócio</h2>
      <ul className={styles.list}>
        <li>
          <ActionRow href="/painel/financeiro" leading={<span className={styles.icon}><NavIcon name="financeiro" /></span>} title="Financeiro" description={props.financeSummary} trailing={<span aria-hidden="true">›</span>} />
        </li>
        <li>
          <ActionRow href="/painel/assinatura" leading={<span className={styles.icon}><NavIcon name="assinatura" /></span>} title="Assinatura" description={props.subscriptionSummary} trailing={<span aria-hidden="true">›</span>} />
        </li>
        <li>
          <ActionRow href="/painel/exercicios" leading={<span className={styles.icon}><NavIcon name="exercicios" /></span>} title="Exercícios" description={props.exercisesSummary} trailing={<span aria-hidden="true">›</span>} />
        </li>
      </ul>

      <h2 className={styles.cap}>Seus dados</h2>
      <ul className={styles.list}>
        <li>
          <ActionRow title="Nome do espaço" description={props.businessName} trailing={edit("business", "Editar nome do espaço")} />
        </li>
        <li>
          <ActionRow
            title="Perfil profissional"
            description={`${props.phone ? formatBrazilianPhone(props.phone) : "sem celular"} · ${props.cref ? `CREF ${props.cref}` : "sem CREF"} · ${studentRangeLabel(props.studentRange)}`}
            trailing={edit("professional", "Editar perfil profissional")}
          />
        </li>
        <li>
          <ActionRow title="Você" description={`${props.name} · ${props.email}`} trailing={edit("personal", "Editar seus dados")} />
        </li>
      </ul>

      <h2 className={styles.cap}>Avisos</h2>
      <PushDeviceRow purpose="Escolha em Configurações quais avisos você quer receber." />

      <h2 className={styles.cap}>Conta</h2>
      <ul className={styles.list}>
        <li>
          <ActionRow
            href="/painel/configuracoes"
            leading={<span className={styles.icon}><NavIcon name="config" /></span>}
            title="Configurações"
            description="Padrões de treino, novo aluno, avisos e segurança"
            trailing={<span aria-hidden="true">›</span>}
          />
        </li>
        <li>
          <PasskeyRow />
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

      <Sheet open={sheet === "business"} onClose={() => setSheet(null)} title="Nome do espaço" description="Aparece para os seus alunos." footer={footer(() => void save({ businessName }, "Nome do espaço salvo"))}>
        {error ? <FormAlert>{error}</FormAlert> : null}
        <TextField label="Nome do espaço" value={businessName} maxLength={80} onChange={(event) => setBusinessName(event.target.value)} />
      </Sheet>

      <Sheet open={sheet === "professional"} onClose={() => setSheet(null)} title="Perfil profissional" footer={footer(() => void save({ phone, cref, studentRangeEstimate: range }, "Perfil profissional salvo"))}>
        {error ? <FormAlert>{error}</FormAlert> : null}
        <div className={styles.stack}>
          <TextField label="Celular" inputMode="tel" value={phone} onChange={(event) => setPhone(formatBrazilianPhone(event.target.value))} />
          <TextField label="CREF (opcional)" value={cref} maxLength={20} onChange={(event) => setCref(event.target.value)} />
          <ChipGroup label="Quantos alunos você atende" showLabel tone="accent" value={range} onChange={setRange} options={STUDENT_RANGE_OPTIONS} />
        </div>
      </Sheet>

      <Sheet open={sheet === "personal"} onClose={() => setSheet(null)} title="Seus dados" description={`E-mail de acesso: ${props.email}`} footer={footer(() => void save({ name }, "Dados salvos"))}>
        {error ? <FormAlert>{error}</FormAlert> : null}
        <TextField label="Seu nome" value={name} maxLength={120} onChange={(event) => setName(event.target.value)} />
      </Sheet>
    </div>
  );
}
