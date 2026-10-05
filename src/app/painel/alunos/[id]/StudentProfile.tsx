"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ActionRow, Avatar, Button, ChipGroup, FormAlert, Sheet, Stepper, Tag, TextField, WeekStrip, useToast } from "@/shared/ui";
import { formatDays, weekStripFromDays } from "@/shared/lib/weekdays";
import { formatCentsBRL as formatBRL } from "@/shared/lib/money";
import { requestJson } from "../../_workout-builder/apiClient";
import type { AccessStatus, ProfileAssessment, ProfileCharge, ProfileProgram, ProfileSession, ProfileStudent, ProgramChoice, TimelineEntry } from "./profileTypes";
import styles from "./StudentProfile.module.css";

const END_REASONS = ["Mudança de cidade", "Objetivo atingido", "Questão financeira", "Outro"];
const METHODS = ["Pix", "Dinheiro", "Cartão", "Transferência"];

type SheetKind = null | "assign" | "invite" | "data" | "inactivate" | "end" | "pay";

interface StudentProfileProps {
  student: ProfileStudent;
  access: { status: AccessStatus; daysLeft: number | null };
  program: ProfileProgram | null;
  programs: ProgramChoice[];
  week: { done: number; target: number | null };
  sessions: ProfileSession[];
  assessments: ProfileAssessment[];
  openCharge: ProfileCharge | null;
  recurrence: { id: string; amountCents: number; day: number } | null;
  /// "O que aconteceu" (EPIC-29): treinos, avaliações e pagamentos juntos,
  /// do mais recente para o mais antigo.
  timeline: TimelineEntry[];
  initialSheet: SheetKind;
}

function accessCopy(status: AccessStatus, daysLeft: number | null): { title: string; meta: string; action: string | null } {
  switch (status) {
    case "CONTA_ATIVA":
      return { title: "Conta ativa", meta: "Já entra no app com e-mail e senha.", action: null };
    case "CONVITE_PENDENTE":
      return { title: "Convite pendente", meta: daysLeft !== null ? `Vale por mais ${daysLeft} ${daysLeft === 1 ? "dia" : "dias"}.` : "Aguardando a ativação.", action: "Gerar novo link" };
    case "CONVITE_EXPIRADO":
      return { title: "Convite expirado", meta: "O link não funciona mais.", action: "Gerar convite" };
    case "CONVITE_CANCELADO":
      return { title: "Convite cancelado", meta: "Não consegue entrar até receber um novo link.", action: "Gerar convite" };
    case "NAO_CONVIDADO":
      return { title: "Sem convite", meta: "Ainda não recebeu o link de acesso.", action: "Gerar convite" };
  }
}

function fmt(value: number) {
  return String(Math.round(value * 10) / 10).replace(".", ",");
}

/// Perfil do aluno (FIT-145, P3 do protótipo): tudo do aluno numa tela e
/// cada ação numa sheet curta — atribuir/trocar/encerrar programa,
/// avaliação já com os últimos valores, "Recebi" da mensalidade, convite,
/// dados, inativar/reativar e encerrar vínculo.
export function StudentProfile({ student, access, program, programs, week, sessions, assessments, openCharge, recurrence, timeline, initialSheet }: StudentProfileProps) {
  const router = useRouter();
  const toast = useToast();
  const [sheet, setSheet] = useState<SheetKind>(initialSheet);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const first = student.displayName.split(/\s+/)[0] ?? student.displayName;
  const active = student.status === "ATIVO";

  // Programa
  const [picked, setPicked] = useState<string | null>(null);
  const last = assessments[0] ?? null;
  // Mensalidade editada no lugar
  const [feeOpen, setFeeOpen] = useState(false);
  const [fee, setFee] = useState(recurrence ? recurrence.amountCents / 100 : 150);
  const [feeDay, setFeeDay] = useState(recurrence?.day ?? 10);
  // Convite
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Dados
  const [name, setName] = useState(student.displayName);
  const [email, setEmail] = useState(student.email);
  // Encerrar vínculo / pagamento
  const [reason, setReason] = useState<string | null>(null);
  const [method, setMethod] = useState("Pix");
  const [when, setWhen] = useState<"hoje" | "ontem">("hoje");

  function close() {
    setSheet(null);
    setError(null);
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível concluir.");
    } finally {
      setBusy(false);
    }
  }

  const accessInfo = accessCopy(access.status, access.daysLeft);

  return (
    <div className={styles.profile}>
      <div className={styles.identity}>
        <Avatar name={student.displayName} className={styles.avatar} />
        <div>
          <p className={styles.muted}>
            {student.status === "ATIVO" ? `Ativo · aluno desde ${student.sinceLabel}` : student.status === "INATIVO" ? "Inativo" : `Vínculo encerrado em ${student.endedLabel}`}
          </p>
        </div>
      </div>

      {student.status === "INATIVO" ? (
        <div className={styles.block}>
          <p className={styles.warn}>{first} está inativo: não acessa o app e não conta no limite do seu plano. Treinos, avaliações e cobranças continuam guardados.</p>
          <Button type="button" block disabled={busy} onClick={() => void run(async () => {
            await requestJson(`/api/students/${student.id}/reativar`, { method: "POST" });
            toast.show(`${first} reativado`);
            router.refresh();
          })}>
            Reativar {first}
          </Button>
        </div>
      ) : null}
      {student.status === "VINCULO_ENCERRADO" ? (
        <p className={styles.warn}>
          Vínculo encerrado em {student.endedLabel}
          {student.endReason ? ` (${student.endReason})` : ""}. Esta ação é definitiva; o histórico fica guardado.
        </p>
      ) : null}

      {active ? (
        program ? (
          <section className={styles.card} aria-label="Programa ativo">
            <p className={styles.eyebrowOk}>Programa ativo</p>
            <p className={styles.cardTitle}>{program.name}</p>
            <p className={styles.muted}>
              {program.week && program.weeks ? `Semana ${program.week} de ${program.weeks} · ` : ""}atribuído {program.assignedLabel}
              {program.daysChosenByStudent ? ` · dias escolhidos por ${first}` : ""}
            </p>
            <div className={styles.strip}>
              <WeekStrip days={weekStripFromDays(program.days, { today: new Date() })} label={`Semana do programa ${program.name}`} />
            </div>
            <div className={styles.actions}>
              <Button href={`/painel/alunos/${student.id}/treino`} variant="quiet">
                Ajustar
              </Button>
              <Button type="button" variant="quiet" onClick={() => setSheet("assign")}>
                Trocar
              </Button>
              <Button type="button" variant="quiet" disabled={busy} onClick={() => void run(async () => {
                await requestJson(`/api/students/${student.id}/plano`, { method: "DELETE" });
                toast.show("Programa encerrado");
                router.refresh();
              })}>
                Encerrar programa
              </Button>
            </div>
          </section>
        ) : (
          <section className={styles.focus} aria-label="Precisa de você">
            <p className={styles.eyebrow}>Precisa de você</p>
            <p className={styles.cardTitle}>{first} está sem programa</p>
            <p className={styles.muted}>{sessions[0] ? `Último treino ${sessions[0].dateLabel}.` : "Ainda não treinou pelo app."}</p>
            <div className={styles.stack}>
              <Button type="button" block onClick={() => setSheet("assign")}>
                Atribuir programa
              </Button>
              <Button href={`/painel/treinos?aluno=${student.id}`} variant="secondary" block>
                Escolher na biblioteca
              </Button>
            </div>
          </section>
        )
      ) : null}

      <h2 className={styles.cap}>Combinado</h2>
      <ActionRow
        title="Ritmo da semana"
        description={week.target ? `${week.done} de ${week.target} treinos` : `${week.done} ${week.done === 1 ? "treino" : "treinos"} nesta semana`}
      />
      {feeOpen ? (
        <div className={styles.inline} role="group" aria-label="Mensalidade">
          <div className={styles.grid2}>
            <Stepper label="Valor (R$)" value={fee} step={10} min={10} max={5000} onChange={setFee} />
            <Stepper label="Todo dia" value={feeDay} step={1} min={1} max={28} onChange={setFeeDay} />
          </div>
          {error ? <FormAlert>{error}</FormAlert> : null}
          <div className={styles.actions}>
            <Button type="button" disabled={busy} onClick={() => void run(async () => {
              if (recurrence) {
                await requestJson(`/api/recorrencias/${recurrence.id}`, { method: "PATCH", body: JSON.stringify({ amountReais: fee, dueDayOfMonth: feeDay }) });
              } else {
                await requestJson(`/api/students/${student.id}/recorrencias`, { method: "POST", body: JSON.stringify({ description: "Mensalidade", amountReais: fee, dueDayOfMonth: feeDay }) });
              }
              toast.show(`Mensalidade: ${formatBRL(fee * 100)} todo dia ${feeDay}`);
              setFeeOpen(false);
              router.refresh();
            })}>
              Salvar
            </Button>
            <Button type="button" variant="quiet" onClick={() => setFeeOpen(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <ActionRow
          title="Mensalidade"
          description={recurrence ? `${formatBRL(recurrence.amountCents)} todo dia ${recurrence.day}` : "Ainda não combinada"}
          trailing={active ? <Button type="button" variant="quiet" onClick={() => setFeeOpen(true)}>{recurrence ? "Ajustar" : "Combinar"}</Button> : null}
        />
      )}
      {openCharge ? (
        <ActionRow
          title={`${openCharge.description} · ${formatBRL(openCharge.amountCents)}`}
          description={
            <>
              {openCharge.status === "ATRASADO" ? <Tag tone="error">Atrasada</Tag> : <Tag>A vencer</Tag>} vence {openCharge.dueLabel}
            </>
          }
          trailing={<Button type="button" variant="quiet" onClick={() => setSheet("pay")}>Recebi</Button>}
        />
      ) : null}
      <ActionRow
        title="Avaliação"
        description={last ? `Última em ${last.dateLabel} · ${summary(last)}` : "Nenhuma ainda"}
        trailing={active ? <Button href={`/painel/alunos/${student.id}/avaliacao`} variant="quiet">Avaliar</Button> : null}
      />

      <h2 className={styles.cap}>O que aconteceu</h2>
      {timeline.length === 0 ? <p className={styles.muted}>Nada por aqui ainda.</p> : null}
      <ol className={styles.timeline} aria-label="O que aconteceu">
        {timeline.slice(0, 12).map((entry) => (
          <li key={`${entry.kind}-${entry.id}`} className={styles.event}>
            <span className={`${styles.dot} ${styles[`dot_${entry.kind}`]}`} aria-hidden="true" />
            <span className={styles.eventBody}>
              <span className={styles.eventTitle}>{entry.title}</span>
              <span className={styles.muted}>{entry.meta}</span>
            </span>
            {entry.kind === "avaliacao" ? (
              <Button type="button" variant="quiet" aria-label={`Excluir avaliação de ${entry.meta}`} onClick={() => void run(async () => {
                await requestJson(`/api/students/${student.id}/avaliacoes/${entry.id}`, { method: "DELETE" });
                toast.show("Avaliação excluída");
                router.refresh();
              })}>
                Excluir
              </Button>
            ) : null}
          </li>
        ))}
      </ol>

      <h2 className={styles.cap}>Acesso</h2>
      <ActionRow
        title={accessInfo.title}
        description={accessInfo.meta}
        trailing={active && accessInfo.action ? <Button type="button" variant="quiet" onClick={() => {
          setSheet("invite");
          setLink(null);
          setCopied(false);
        }}>{accessInfo.action}</Button> : null}
      />
      <ActionRow title="Dados" description={student.email} trailing={<Button type="button" variant="quiet" onClick={() => setSheet("data")}>Editar</Button>} />

      {student.status !== "VINCULO_ENCERRADO" ? (
        <>
          <h2 className={styles.cap}>Vínculo</h2>
          {active ? <ActionRow title="Inativar" description="Pausa o acesso. Dá para reativar." onClick={() => setSheet("inactivate")} trailing={<span aria-hidden="true">›</span>} /> : null}
          <ActionRow title={<span className={styles.danger}>Encerrar vínculo</span>} description={`${first} segue com a conta como FitOS Livre.`} onClick={() => setSheet("end")} trailing={<span aria-hidden="true">›</span>} />
        </>
      ) : null}

      {/* Atribuir/trocar programa */}
      <Sheet
        open={sheet === "assign"}
        onClose={close}
        title="Escolha o programa"
        description={`${first} recebe a própria cópia. Mudar o programa original depois não altera o dele.`}
        footer={
          <>
            <Button type="button" block disabled={!picked || busy} onClick={() => void run(async () => {
              await requestJson(`/api/students/${student.id}/plano`, { method: "POST", body: JSON.stringify({ trainingPlanId: picked }) });
              toast.show(`Programa atribuído a ${first}`);
              close();
              router.refresh();
            })}>
              Atribuir a {first}
            </Button>
            <Button type="button" variant="quiet" block onClick={close}>Agora não</Button>
          </>
        }
      >
        {error ? <FormAlert>{error}</FormAlert> : null}
        {programs.length === 0 ? (
          <p className={styles.muted}>
            Nenhum programa ainda. <Link href="/painel/treinos/planos/novo" className={styles.link}>Montar um programa</Link>
          </p>
        ) : (
          <div className={styles.options} role="radiogroup" aria-label="Programas">
            {programs.map((choice) => (
              <button key={choice.id} type="button" role="radio" aria-checked={picked === choice.id} className={picked === choice.id ? `${styles.option} ${styles.optionOn}` : styles.option} onClick={() => setPicked(choice.id)}>
                <span className={styles.optionTitle}>{choice.name}</span>
                <span className={styles.muted}>
                  {choice.durationWeeks ? `${choice.durationWeeks} semanas · ` : ""}
                  {choice.workoutCount} {choice.workoutCount === 1 ? "treino" : "treinos"} · {formatDays(choice.days)}
                </span>
              </button>
            ))}
          </div>
        )}
      </Sheet>

      {/* Convite */}
      <Sheet
        open={sheet === "invite"}
        onClose={close}
        title={`Convite de ${first}`}
        description={link ? "Mande o link por onde vocês conversam. Ele vale por 7 dias e só aparece agora." : access.status === "CONVITE_PENDENTE" ? "Gerar um novo link invalida o anterior." : "Gere o link de acesso para enviar."}
        footer={
          link ? (
            <Button type="button" variant="quiet" block onClick={close}>Fechar</Button>
          ) : (
            <>
              <Button type="button" block disabled={busy} onClick={() => void run(async () => {
                const result = await requestJson<{ link: string }>(`/api/students/${student.id}/convite`, { method: "POST" });
                setLink(result.link);
                router.refresh();
              })}>
                {access.status === "CONVITE_PENDENTE" ? "Gerar novo link" : "Gerar convite"}
              </Button>
              {access.status === "CONVITE_PENDENTE" ? (
                <Button type="button" variant="quiet" block disabled={busy} onClick={() => void run(async () => {
                  await requestJson(`/api/students/${student.id}/convite`, { method: "DELETE" });
                  toast.show("Convite cancelado");
                  close();
                  router.refresh();
                })}>
                  <span className={styles.danger}>Cancelar convite</span>
                </Button>
              ) : null}
            </>
          )
        }
      >
        {error ? <FormAlert>{error}</FormAlert> : null}
        {link ? (
          <>
            <input className={styles.linkBox} readOnly value={link} aria-label="Link de ativação" onFocus={(event) => event.currentTarget.select()} />
            <div className={styles.grid2}>
              <Button type="button" variant="secondary" onClick={async () => {
                await navigator.clipboard.writeText(link).catch(() => {});
                setCopied(true);
              }}>
                {copied ? "Copiado!" : "Copiar link"}
              </Button>
              <Button type="button" variant="secondary" onClick={async () => {
                const text = `Oi, ${first}! Seu acesso ao FitOS está pronto: ${link}`;
                if (navigator.share) await navigator.share({ title: "Convite FitOS", text }).catch(() => {});
                else {
                  await navigator.clipboard.writeText(text).catch(() => {});
                  toast.show("Mensagem copiada para colar onde vocês conversam");
                }
              }}>
                Compartilhar
              </Button>
            </div>
          </>
        ) : null}
      </Sheet>

      {/* Dados */}
      <Sheet
        open={sheet === "data"}
        onClose={close}
        title={`Dados de ${first}`}
        footer={
          <>
            <Button type="button" block disabled={busy || !name.trim()} onClick={() => void run(async () => {
              await requestJson(`/api/students/${student.id}`, { method: "PATCH", body: JSON.stringify(student.hasAccount ? { name: name.trim() } : { name: name.trim(), email: email.trim().toLowerCase() }) });
              toast.show("Dados salvos");
              close();
              router.refresh();
            })}>
              Salvar
            </Button>
            <Button type="button" variant="quiet" block onClick={close}>Cancelar</Button>
          </>
        }
      >
        {error ? <FormAlert>{error}</FormAlert> : null}
        <div className={styles.stack}>
          <TextField label="Nome completo" value={name} onChange={(event) => setName(event.target.value)} />
          <TextField label="E-mail" type="email" value={email} disabled={student.hasAccount} onChange={(event) => setEmail(event.target.value)} />
          {student.hasAccount ? <p className={styles.muted}>O e-mail é o login de {first} e não pode ser trocado aqui.</p> : null}
        </div>
      </Sheet>

      {/* Inativar */}
      <Sheet
        open={sheet === "inactivate"}
        onClose={close}
        title={`Inativar ${first}?`}
        footer={
          <>
            <Button type="button" variant="danger" block disabled={busy} onClick={() => void run(async () => {
              await requestJson(`/api/students/${student.id}/inativar`, { method: "POST" });
              toast.show(`${first} inativado`);
              close();
              router.refresh();
            })}>
              Inativar
            </Button>
            <Button type="button" variant="quiet" block onClick={close}>Voltar</Button>
          </>
        }
      >
        {error ? <FormAlert>{error}</FormAlert> : null}
        <ul className={styles.bullets}>
          <li>Deixa de acessar o app até você reativar.</li>
          <li>Libera uma vaga no seu plano.</li>
          <li>Histórico, avaliações e cobranças ficam guardados.</li>
        </ul>
      </Sheet>

      {/* Encerrar vínculo */}
      <Sheet
        open={sheet === "end"}
        onClose={close}
        title="Encerrar vínculo?"
        description={`${first} sai do seu espaço e continua com a conta como FitOS Livre, levando o histórico de treinos. Isso não pode ser desfeito.`}
        footer={
          <>
            <Button type="button" variant="danger" block disabled={busy} onClick={() => void run(async () => {
              await requestJson(`/api/students/${student.id}/encerrar-vinculo`, { method: "POST", body: JSON.stringify({ reason }) });
              toast.show(`Vínculo com ${first} encerrado`);
              close();
              router.push("/painel/alunos");
              router.refresh();
            })}>
              Encerrar vínculo
            </Button>
            <Button type="button" variant="quiet" block onClick={close}>Voltar</Button>
          </>
        }
      >
        {error ? <FormAlert>{error}</FormAlert> : null}
        <ChipGroup label="Motivo (opcional)" showLabel tone="accent" value={reason} allowDeselect onClear={() => setReason(null)} onChange={setReason} options={END_REASONS.map((r) => ({ value: r, label: r }))} />
      </Sheet>

      {/* Recebi */}
      {openCharge ? (
        <Sheet
          open={sheet === "pay"}
          onClose={close}
          title={`Recebi de ${first}`}
          description={`${openCharge.description} · ${formatBRL(openCharge.amountCents)}`}
          footer={
            <>
              <Button type="button" block disabled={busy} onClick={() => void run(async () => {
                const paidAt = new Date();
                if (when === "ontem") paidAt.setDate(paidAt.getDate() - 1);
                await requestJson(`/api/cobrancas/${openCharge.id}/pagamentos`, {
                  method: "POST",
                  body: JSON.stringify({ amountReceivedReais: openCharge.amountCents / 100, paidAt: paidAt.toISOString(), method }),
                });
                toast.show(`Pagamento de ${formatBRL(openCharge.amountCents)} registrado`);
                close();
                router.refresh();
              })}>
                Confirmar pagamento
              </Button>
              <Button type="button" variant="quiet" block onClick={close}>Voltar</Button>
            </>
          }
        >
          {error ? <FormAlert>{error}</FormAlert> : null}
          <div className={styles.stack}>
            <ChipGroup label="Quando" showLabel tone="accent" value={when} onChange={setWhen} options={[{ value: "hoje", label: "Hoje" }, { value: "ontem", label: "Ontem" }]} />
            <ChipGroup label="Forma de pagamento" showLabel tone="accent" value={method} onChange={setMethod} options={METHODS.map((m) => ({ value: m, label: m }))} />
            <p className={styles.muted}>Recebeu outro valor ou em outra data? Registre pelo Financeiro.</p>
          </div>
        </Sheet>
      ) : null}
    </div>
  );
}

function summary(assessment: ProfileAssessment): string {
  const parts: string[] = [];
  if (assessment.weightKg !== null) parts.push(`${fmt(assessment.weightKg)} kg`);
  if (assessment.bodyFatPercent !== null) parts.push(`${fmt(assessment.bodyFatPercent)}% gordura`);
  const waist = assessment.measurements.find((m) => m.type === "CINTURA");
  if (waist) parts.push(`cintura ${fmt(waist.valueCm)} cm`);
  return parts.length > 0 ? parts.join(" · ") : (assessment.notes ?? "Sem medidas");
}
