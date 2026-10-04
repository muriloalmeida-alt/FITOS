"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, FormAlert, NextStepCard, Sheet, TextField, useToast } from "@/shared/ui";
import { ApiError, requestJson } from "../_workout-builder/apiClient";
import styles from "./InviteStudent.module.css";

/// "Convidar ou cadastrar" (FIT-144): só nome e e-mail. Cria o aluno e já
/// gera o convite; o link aparece na hora, com Copiar e Compartilhar (o
/// FitOS não envia mensagem — comunicação fica para o EPIC-24).
export function InviteStudent({ startOpen = false }: { startOpen?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(startOpen);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<{ message: string; limit: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<{ id: string; firstName: string; link: string | null } | null>(null);
  const [copied, setCopied] = useState(false);

  function reset() {
    setOpen(false);
    setName("");
    setEmail("");
    setError(null);
    setCreated(null);
    setCopied(false);
  }

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const student = await requestJson<{ id: string }>("/api/students", { method: "POST", body: JSON.stringify({ name, email }) });
      let link: string | null = null;
      try {
        link = (await requestJson<{ link: string }>(`/api/students/${student.id}/convite`, { method: "POST" })).link;
      } catch {
        link = null;
      }
      setCreated({ id: student.id, firstName: name.trim().split(/\s+/)[0] ?? name, link });
      router.refresh();
    } catch (cause) {
      const limit = cause instanceof ApiError && cause.kind === "LIMITE_DE_ALUNOS_ATINGIDO";
      setError({ message: cause instanceof Error ? cause.message : "Não foi possível cadastrar.", limit });
    } finally {
      setSaving(false);
    }
  }

  async function copy() {
    if (!created?.link) return;
    try {
      await navigator.clipboard.writeText(created.link);
      setCopied(true);
    } catch {
      toast.show("Não foi possível copiar. Selecione o link e copie.");
    }
  }

  async function share() {
    if (!created?.link) return;
    const text = `Oi, ${created.firstName}! Seu acesso ao FitOS está pronto: ${created.link}`;
    if (navigator.share) {
      await navigator.share({ title: "Convite FitOS", text }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(text).catch(() => {});
      toast.show("Mensagem copiada para colar onde vocês conversam");
    }
  }

  const valid = name.trim().length > 0 && /.+@.+\..+/.test(email.trim());

  return (
    <>
      <NextStepCard eyebrow="Novo aluno" title="Convidar ou cadastrar" description="Só nome e e-mail. O resto ele preenche." onClick={() => setOpen(true)} />
      {created ? (
        <Sheet
          open={open}
          onClose={reset}
          title={`Convite pronto para ${created.firstName}`}
          description={created.link ? "Mande o link por onde vocês conversam. Ele vale por 7 dias e só aparece agora." : "Aluno cadastrado. Gere o convite no perfil dele."}
          footer={
            <>
              <Button href={`/painel/alunos/${created.id}?atribuir=1`} block onClick={reset}>
                Atribuir programa
              </Button>
              <Button href={`/painel/alunos/${created.id}`} variant="quiet" block onClick={reset}>
                Abrir perfil
              </Button>
            </>
          }
        >
          {created.link ? (
            <>
              <input className={styles.link} readOnly value={created.link} aria-label="Link de ativação" onFocus={(event) => event.currentTarget.select()} />
              <div className={styles.grid}>
                <Button type="button" variant="secondary" onClick={() => void copy()}>
                  {copied ? "Copiado!" : "Copiar link"}
                </Button>
                <Button type="button" variant="secondary" onClick={() => void share()}>
                  Compartilhar
                </Button>
              </div>
            </>
          ) : null}
        </Sheet>
      ) : (
        <Sheet
          open={open}
          onClose={reset}
          title="Novo aluno"
          description="Ele recebe um link para criar a senha e entrar. Telefone, objetivo e o resto vêm depois, se precisar."
          footer={
            <>
              <Button type="button" block disabled={!valid || saving} onClick={() => void submit()}>
                {saving ? "Cadastrando…" : "Cadastrar e gerar convite"}
              </Button>
              <Button type="button" variant="quiet" block onClick={reset}>
                Cancelar
              </Button>
            </>
          }
        >
          <div className={styles.fields}>
            {error ? (
              <FormAlert>
                {error.message}{" "}
                {error.limit ? (
                  <Link href="/painel/assinatura" className={styles.inlineLink}>
                    Ver planos
                  </Link>
                ) : null}
              </FormAlert>
            ) : null}
            <TextField label="Nome completo" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Pedro Lima" autoComplete="off" />
            <TextField label="E-mail" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="pedro@email.com" autoComplete="off" />
          </div>
        </Sheet>
      )}
    </>
  );
}
