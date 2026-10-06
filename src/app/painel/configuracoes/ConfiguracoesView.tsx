"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ActionRow, Button, ChipGroup, FormAlert, Sheet, Stepper, Switch, TextField, useToast } from "@/shared/ui";
import { formatCentsBRL } from "@/shared/lib/money";
import { authClient } from "@/modules/identity/auth-client";
import { requestJson } from "../_workout-builder/apiClient";
import { PushDeviceRow } from "../_push/PushDeviceRow";
import { forgetAccount } from "../../_entrada/rememberedAccount";
import { ReceivePayments, type ReceivePaymentsProps } from "./ReceivePayments";
import styles from "../perfil/PersonalProfileView.module.css";
import own from "./Configuracoes.module.css";

const EXPORT_URL = "/api/minha-conta/exportar";

type Prescription = { sets: number; reps: number; restSeconds: number };
type Alerts = { daysChanged: boolean; inactiveDays: number | null; overdue: boolean; programEnd: boolean };

interface Props {
  prescription: Prescription;
  invite: { programId: string | null; programName: string | null; feeCents: number | null; feeDay: number | null };
  programs: { id: string; name: string; meta: string }[];
  alerts: Alerts;
  devices: { id: string; label: string; lastActiveIso: string; current: boolean }[];
  hasPassword: boolean;
  /// Conta Asaas do personal para cobrar os alunos pelo app (EPIC-38).
  payments?: ReceivePaymentsProps;
}

type SheetKind = null | "prescription" | "program" | "fee" | "inactive" | "password" | "delete";

const NO_PROGRAM = "__nenhum__";
const INACTIVE_OPTIONS = [
  { value: "0", label: "Desligado" },
  { value: "3", label: "3 dias" },
  { value: "5", label: "5 dias" },
  { value: "7", label: "7 dias" },
  { value: "14", label: "14 dias" },
];

export function prescriptionLabel(p: Prescription): string {
  return `${p.sets} × ${p.reps} · ${p.restSeconds} s de descanso`;
}

function lastActiveLabel(iso: string, now: number): string {
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (minutes < 60) return "ativo há pouco";
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `ativo há ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? "ativo ontem" : `ativo há ${days} dias`;
}

/// Configurações do personal (EPIC-36): padrões de treino e de novo aluno,
/// avisos escolhidos, segurança da conta e seus dados (baixar e excluir,
/// EPIC-37). Cada ajuste salva na hora.
export function ConfiguracoesView({ prescription, invite, programs, alerts: initialAlerts, devices, hasPassword, payments = { status: "NAO_ATIVADO", onboardingUrl: null, payoutPixKey: null, balanceCents: null, ownerName: "" } }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Prescription>(prescription);
  const [program, setProgram] = useState<string>(invite.programId ?? NO_PROGRAM);
  const [fee, setFee] = useState({ cents: invite.feeCents ?? 15000, day: invite.feeDay ?? 10 });
  const [alerts, setAlerts] = useState<Alerts>(initialAlerts);
  const [password, setPassword] = useState({ current: "", next: "" });
  const [confirmDelete, setConfirmDelete] = useState("");
  const [now] = useState(() => Date.now());

  function open(kind: Exclude<SheetKind, null>) {
    setError(null);
    setDraft(prescription);
    setProgram(invite.programId ?? NO_PROGRAM);
    setFee({ cents: invite.feeCents ?? 15000, day: invite.feeDay ?? 10 });
    setPassword({ current: "", next: "" });
    setConfirmDelete("");
    setSheet(kind);
  }

  async function run(action: () => Promise<unknown>, message: string, close = true) {
    setBusy(true);
    setError(null);
    try {
      await action();
      toast.show(message);
      if (close) setSheet(null);
      router.refresh();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const saveInvite = (body: object, message: string) => run(() => requestJson("/api/students/convite-link", { method: "PATCH", body: JSON.stringify(body) }), message);

  async function saveAlerts(patch: Partial<Alerts>, message: string) {
    const previous = alerts;
    setAlerts({ ...alerts, ...patch });
    const ok = await run(() => requestJson("/api/configuracoes/avisos", { method: "PATCH", body: JSON.stringify(patch) }), message, patch.inactiveDays !== undefined);
    if (!ok) {
      setAlerts(previous);
      toast.show("Não foi possível salvar o aviso.");
    }
  }

  async function changePassword() {
    if (password.next.length < 8) {
      setError("A nova senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    await run(async () => {
      const { error: failure } = await authClient.changePassword({ currentPassword: password.current, newPassword: password.next, revokeOtherSessions: true });
      if (failure) throw new Error(failure.code === "INVALID_PASSWORD" ? "A senha atual não confere." : "Não foi possível trocar a senha.");
    }, "Senha trocada. Os outros aparelhos saíram.");
  }

  async function deleteAccount() {
    setBusy(true);
    setError(null);
    try {
      await requestJson("/api/minha-conta/excluir", { method: "POST", body: JSON.stringify(hasPassword ? { password: confirmDelete } : { confirmation: confirmDelete }) });
      forgetAccount();
      router.replace("/");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível excluir a conta.");
      setBusy(false);
    }
  }

  const footer = (onSave: () => void, label = "Salvar") => (
    <>
      <Button type="button" block disabled={busy} onClick={onSave}>
        {label}
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
  const others = devices.filter((device) => !device.current);

  return (
    <div className={styles.profile}>
      <h2 className={styles.cap}>Treinos</h2>
      <ul className={styles.list}>
        <li>
          <ActionRow title="Prescrição padrão" description={`Exercícios novos entram com ${prescriptionLabel(prescription)}.`} trailing={edit("prescription", "Editar prescrição padrão")} />
        </li>
      </ul>

      <h2 className={styles.cap}>Novo aluno pelo link</h2>
      <ul className={styles.list}>
        <li>
          <ActionRow title="Programa" description={invite.programName ?? "Nenhum: você atribui depois"} trailing={edit("program", "Editar programa do novo aluno")} />
        </li>
        <li>
          <ActionRow title="Mensalidade" description={invite.feeCents ? `${formatCentsBRL(invite.feeCents)} todo dia ${invite.feeDay ?? 10}` : "Nenhuma: você combina depois"} trailing={edit("fee", "Editar mensalidade do novo aluno")} />
        </li>
      </ul>

      <h2 className={styles.cap}>Receber pelo app</h2>
      <ReceivePayments {...payments} />

      <h2 className={styles.cap}>Avisos no celular</h2>
      <PushDeviceRow purpose="Ligue para receber neste celular os avisos que você escolher abaixo." />
      <div className={styles.stack}>
        <Switch label="Aluno mudou os dias de treino" checked={alerts.daysChanged} onChange={(checked) => void saveAlerts({ daysChanged: checked }, checked ? "Aviso ligado" : "Aviso desligado")} />
        <Switch label="Mensalidade atrasou" description="No dia seguinte ao vencimento." checked={alerts.overdue} onChange={(checked) => void saveAlerts({ overdue: checked }, checked ? "Aviso ligado" : "Aviso desligado")} />
        <Switch label="Programa do aluno terminou" description="Quando passam as semanas do programa." checked={alerts.programEnd} onChange={(checked) => void saveAlerts({ programEnd: checked }, checked ? "Aviso ligado" : "Aviso desligado")} />
      </div>
      <ul className={styles.list}>
        <li>
          <ActionRow title="Aluno sem treinar" description={alerts.inactiveDays ? `Depois de ${alerts.inactiveDays} dias sem treino` : "Desligado"} trailing={edit("inactive", "Editar aviso de aluno sem treinar")} />
        </li>
      </ul>

      <h2 className={styles.cap}>Segurança</h2>
      <ul className={styles.list}>
        {hasPassword ? (
          <li>
            <ActionRow title="Senha" description="Trocar a senha desconecta os outros aparelhos." trailing={<Button type="button" variant="quiet" onClick={() => open("password")}>Trocar</Button>} />
          </li>
        ) : null}
        {devices.map((device) => (
          <li key={device.id}>
            <ActionRow
              title={device.label}
              description={device.current ? "Este aparelho" : lastActiveLabel(device.lastActiveIso, now)}
              trailing={
                device.current ? null : (
                  <Button type="button" variant="quiet" disabled={busy} aria-label={`Desconectar ${device.label}`} onClick={() => void run(() => requestJson(`/api/minha-conta/aparelhos/${device.id}`, { method: "DELETE" }), "Aparelho desconectado")}>
                    Desconectar
                  </Button>
                )
              }
            />
          </li>
        ))}
      </ul>
      {others.length > 1 ? (
        <Button type="button" variant="secondary" block disabled={busy} onClick={() => void run(() => requestJson("/api/minha-conta/aparelhos/outros", { method: "DELETE" }), "Os outros aparelhos saíram")}>
          Sair de todos os outros aparelhos
        </Button>
      ) : null}

      <h2 className={styles.cap}>Seus dados</h2>
      <ul className={styles.list}>
        <li>
          <ActionRow
            title="Baixar meus dados"
            description="Alunos, treinos, avaliações, metas e cobranças em planilhas."
            trailing={
              <a href={EXPORT_URL} download className={own.download}>
                Baixar
              </a>
            }
          />
        </li>
        <li>
          <ActionRow title="Excluir minha conta" description="Apaga o seu espaço e tudo o que está nele. Não dá para desfazer." trailing={<Button type="button" variant="quiet" onClick={() => open("delete")}>Excluir</Button>} />
        </li>
      </ul>

      <Sheet open={sheet === "prescription"} onClose={() => setSheet(null)} title="Prescrição padrão" description="Vale para os próximos exercícios que você colocar num treino. Os treinos de hoje não mudam." footer={footer(() => void run(() => requestJson("/api/configuracoes/prescricao", { method: "PATCH", body: JSON.stringify(draft) }), "Prescrição padrão salva"))}>
        <div className={styles.stack}>
          <Stepper label="Séries" value={draft.sets} min={1} max={10} onChange={(sets) => setDraft({ ...draft, sets })} />
          <Stepper label="Repetições" value={draft.reps} min={1} max={50} onChange={(reps) => setDraft({ ...draft, reps })} />
          <Stepper label="Descanso" value={draft.restSeconds} min={0} max={300} step={15} format={(value) => `${value} s`} onChange={(restSeconds) => setDraft({ ...draft, restSeconds })} />
          {error ? <FormAlert>{error}</FormAlert> : null}
        </div>
      </Sheet>

      <Sheet open={sheet === "program"} onClose={() => setSheet(null)} title="Programa do novo aluno" description="Quem entra pelo seu link já recebe uma cópia deste programa." footer={footer(() => void saveInvite({ programId: program === NO_PROGRAM ? null : program }, "Programa do novo aluno salvo"))}>
        <ChipGroup
          label="Programa"
          variant="card"
          columns={1}
          value={program}
          onChange={setProgram}
          options={[{ value: NO_PROGRAM, label: "Nenhum", description: "Você atribui depois" }, ...programs.map((entry) => ({ value: entry.id, label: entry.name, description: entry.meta }))]}
        />
        {error ? <FormAlert>{error}</FormAlert> : null}
      </Sheet>

      <Sheet
        open={sheet === "fee"}
        onClose={() => setSheet(null)}
        title="Mensalidade do novo aluno"
        description="Combinada assim que o aluno entra pelo link. Os meses se geram sozinhos."
        footer={
          <>
            <Button type="button" block disabled={busy} onClick={() => void saveInvite({ feeCents: fee.cents, feeDay: fee.day }, "Mensalidade do novo aluno salva")}>
              Salvar
            </Button>
            {invite.feeCents ? (
              <Button type="button" variant="quiet" block disabled={busy} onClick={() => void saveInvite({ feeCents: null, feeDay: null }, "Sem mensalidade no link")}>
                Sem mensalidade
              </Button>
            ) : null}
          </>
        }
      >
        <div className={styles.stack}>
          <Stepper label="Valor" value={fee.cents} min={1000} max={200000} step={1000} format={(value) => formatCentsBRL(value)} onChange={(cents) => setFee({ ...fee, cents })} />
          <Stepper label="Vence todo dia" value={fee.day} min={1} max={28} onChange={(day) => setFee({ ...fee, day })} />
          {error ? <FormAlert>{error}</FormAlert> : null}
        </div>
      </Sheet>

      <Sheet open={sheet === "inactive"} onClose={() => setSheet(null)} title="Aluno sem treinar" description="Um aviso por aluno quando ele passa desse tempo sem treinar. Só alunos com programa e acesso ao app.">
        <ChipGroup
          label="Avisar depois de"
          value={String(alerts.inactiveDays ?? 0)}
          onChange={(value) => void saveAlerts({ inactiveDays: value === "0" ? null : Number(value) }, value === "0" ? "Aviso desligado" : `Aviso depois de ${value} dias`)}
          options={INACTIVE_OPTIONS}
        />
        {error ? <FormAlert>{error}</FormAlert> : null}
      </Sheet>

      <Sheet
        open={sheet === "delete"}
        onClose={() => setSheet(null)}
        title="Excluir sua conta?"
        description="Seus alunos, programas, treinos, avaliações, fotos e cobranças são apagados e a assinatura do FitOS é cancelada. As contas dos alunos continuam, sem vínculo com você. Não dá para desfazer."
        footer={
          <>
            <Button type="button" block disabled={busy || confirmDelete.trim().length === 0} onClick={() => void deleteAccount()}>
              {busy ? "Excluindo…" : "Excluir minha conta"}
            </Button>
            <Button type="button" variant="quiet" block onClick={() => setSheet(null)}>
              Manter minha conta
            </Button>
          </>
        }
      >
        <div className={styles.stack}>
          <a href={EXPORT_URL} download className={own.downloadBlock}>
            Baixar meus dados antes
          </a>
          {hasPassword ? (
            <TextField label="Sua senha, para confirmar" type="password" autoComplete="current-password" value={confirmDelete} onChange={(event) => setConfirmDelete(event.target.value)} />
          ) : (
            <TextField label="Digite EXCLUIR para confirmar" autoCapitalize="characters" value={confirmDelete} onChange={(event) => setConfirmDelete(event.target.value)} />
          )}
          {error ? <FormAlert>{error}</FormAlert> : null}
        </div>
      </Sheet>

      <Sheet open={sheet === "password"} onClose={() => setSheet(null)} title="Trocar senha" description="Os outros aparelhos saem da conta; este continua conectado." footer={footer(() => void changePassword(), "Trocar senha")}>
        <div className={styles.stack}>
          <TextField label="Senha atual" type="password" autoComplete="current-password" value={password.current} onChange={(event) => setPassword({ ...password, current: event.target.value })} />
          <TextField label="Nova senha" type="password" autoComplete="new-password" minLength={8} value={password.next} onChange={(event) => setPassword({ ...password, next: event.target.value })} />
          {error ? <FormAlert>{error}</FormAlert> : null}
        </div>
      </Sheet>
    </div>
  );
}
