"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ActionRow, Button, ChipGroup, FormAlert, Sheet, Tag, TextField, useToast } from "@/shared/ui";
import { formatCentsBRL } from "@/shared/lib/money";
import { requestJson } from "../_workout-builder/apiClient";
import styles from "../perfil/PersonalProfileView.module.css";
import own from "./Configuracoes.module.css";

export interface ReceivePaymentsProps {
  status: "NAO_ATIVADO" | "PENDENTE" | "APROVADA" | "RECUSADA";
  onboardingUrl: string | null;
  payoutPixKey: string | null;
  balanceCents: number | null;
  ownerName: string;
}

const INCOMES = [
  { value: "2000", label: "Até R$ 2 mil" },
  { value: "5000", label: "R$ 2 a 5 mil" },
  { value: "10000", label: "R$ 5 a 10 mil" },
  { value: "20000", label: "Mais de R$ 10 mil" },
];
const COMPANY_TYPES = [
  { value: "MEI", label: "MEI" },
  { value: "LIMITED", label: "LTDA" },
  { value: "INDIVIDUAL", label: "Empresário individual" },
];

const onlyDigits = (value: string) => value.replace(/\D/g, "");

/// Receber pelo app (EPIC-38): o personal ativa com um cadastro curto e o
/// FitOS cria a conta de recebimento dele no Asaas. Depois: enviar os
/// documentos da verificação, acompanhar a aprovação, ver o saldo e sacar
/// por Pix. O FitOS fica com 2% de cada mensalidade paga.
export function ReceivePayments({ status, onboardingUrl, payoutPixKey, balanceCents, ownerName }: ReceivePaymentsProps) {
  const router = useRouter();
  const toast = useToast();
  const [sheet, setSheet] = useState<null | "activate" | "withdraw" | "pix">(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ cpfCnpj: "", birthDate: "", companyType: "MEI", mobilePhone: "", postalCode: "", address: "", addressNumber: "", complement: "", province: "", incomeValue: "5000", payoutPixKey: "" });
  const [newPix, setNewPix] = useState("");
  const company = onlyDigits(form.cpfCnpj).length > 11;
  const set = (key: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [key]: value }));

  async function run(action: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError(null);
    try {
      await action();
      toast.show(message);
      setSheet(null);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível concluir.");
    } finally {
      setBusy(false);
    }
  }

  /// Endereço pelo CEP (ViaCEP); a pessoa confere e completa.
  async function lookupCep(cep: string) {
    if (onlyDigits(cep).length !== 8) return;
    const data = (await fetch(`https://viacep.com.br/ws/${onlyDigits(cep)}/json/`).then((r) => (r.ok ? r.json() : null)).catch(() => null)) as { logradouro?: string; bairro?: string; erro?: boolean } | null;
    if (!data || data.erro) return;
    setForm((current) => ({ ...current, address: current.address || data.logradouro || "", province: current.province || data.bairro || "" }));
  }

  function open(next: "activate" | "withdraw" | "pix") {
    setError(null);
    setNewPix(payoutPixKey ?? "");
    setSheet(next);
  }

  const statusTag =
    status === "APROVADA" ? <Tag tone="ok">Ativo</Tag> : status === "RECUSADA" ? <Tag tone="error">Recusado</Tag> : status === "PENDENTE" ? <Tag tone="warn">Verificação</Tag> : null;

  return (
    <>
      <ul className={styles.list}>
        {status === "NAO_ATIVADO" ? (
          <li>
            <ActionRow
              title="Cobrar os alunos pelo app"
              description="Pix, boleto ou cartão direto para você, com baixa automática. Taxa FitOS de 2% por mensalidade paga, mais a tarifa do meio de pagamento."
              trailing={
                <Button type="button" variant="quiet" onClick={() => open("activate")}>
                  Ativar
                </Button>
              }
            />
          </li>
        ) : (
          <>
            <li>
              <ActionRow
                title={<>Recebimento {statusTag}</>}
                description={
                  status === "APROVADA"
                    ? "Conta aprovada. Os pagamentos dos alunos caem aqui."
                    : status === "RECUSADA"
                      ? "O Asaas recusou a verificação. Reenvie os documentos pelo link."
                      : "Já dá para cobrar. Envie seus documentos para liberar os saques."
                }
                trailing={
                  status !== "APROVADA" && onboardingUrl ? (
                    <a href={onboardingUrl} target="_blank" rel="noreferrer" className={own.download}>
                      Enviar documentos
                    </a>
                  ) : null
                }
              />
            </li>
            <li>
              <ActionRow
                title={balanceCents === null ? "Saldo" : `Saldo ${formatCentsBRL(balanceCents)}`}
                description={payoutPixKey ? `Saque para o Pix ${payoutPixKey}` : "Cadastre uma chave Pix para os saques"}
                trailing={
                  <span style={{ display: "flex", gap: 4 }}>
                    <Button type="button" variant="quiet" onClick={() => open("pix")}>
                      Pix
                    </Button>
                    {status === "APROVADA" && balanceCents ? (
                      <Button type="button" variant="quiet" onClick={() => open("withdraw")}>
                        Sacar
                      </Button>
                    ) : null}
                  </span>
                }
              />
            </li>
          </>
        )}
      </ul>

      <Sheet
        open={sheet === "activate"}
        onClose={() => setSheet(null)}
        title="Ativar recebimento pelo app"
        description={`Criamos sua conta de recebimento no Asaas, em nome de ${ownerName.split(/\s+/)[0] || "você"}. Você não precisa entrar no Asaas.`}
        footer={
          <Button type="button" block disabled={busy} onClick={() => void run(() => requestJson("/api/configuracoes/recebimento", { method: "POST", body: JSON.stringify({ ...form, companyType: company ? form.companyType : null, birthDate: company ? null : form.birthDate, incomeValue: Number(form.incomeValue) }) }), "Recebimento ativado")}>
            {busy ? "Criando sua conta…" : "Ativar"}
          </Button>
        }
      >
        <div className={styles.stack}>
          <TextField label="CPF ou CNPJ" inputMode="numeric" value={form.cpfCnpj} onChange={(event) => set("cpfCnpj")(event.target.value)} />
          {company ? (
            <ChipGroup label="Tipo da empresa" value={form.companyType} onChange={set("companyType")} options={COMPANY_TYPES} />
          ) : (
            <TextField label="Data de nascimento" type="date" value={form.birthDate} onChange={(event) => set("birthDate")(event.target.value)} />
          )}
          <TextField label="Celular com DDD" type="tel" inputMode="tel" autoComplete="tel" value={form.mobilePhone} onChange={(event) => set("mobilePhone")(event.target.value)} />
          <TextField label="CEP" inputMode="numeric" autoComplete="postal-code" value={form.postalCode} onChange={(event) => set("postalCode")(event.target.value)} onBlur={(event) => void lookupCep(event.target.value)} />
          <TextField label="Endereço" autoComplete="address-line1" value={form.address} onChange={(event) => set("address")(event.target.value)} />
          <div className={own.row}>
            <TextField label="Número" value={form.addressNumber} onChange={(event) => set("addressNumber")(event.target.value)} />
            <TextField label="Complemento" value={form.complement} onChange={(event) => set("complement")(event.target.value)} />
          </div>
          <TextField label="Bairro" value={form.province} onChange={(event) => set("province")(event.target.value)} />
          <ChipGroup label={company ? "Faturamento mensal" : "Renda mensal"} value={form.incomeValue} onChange={set("incomeValue")} options={INCOMES} />
          <TextField label="Chave Pix para os saques" autoComplete="off" value={form.payoutPixKey} onChange={(event) => set("payoutPixKey")(event.target.value)} />
          <p className={styles.muted}>Depois o Asaas pede uma foto do documento e uma selfie, pelo link que aparece aqui. Até a aprovação já dá para cobrar; o saque libera com a conta aprovada.</p>
          {error ? <FormAlert>{error}</FormAlert> : null}
        </div>
      </Sheet>

      <Sheet
        open={sheet === "withdraw"}
        onClose={() => setSheet(null)}
        title={`Sacar ${balanceCents ? formatCentsBRL(balanceCents) : ""}`}
        description={`Vai para o Pix ${payoutPixKey ?? ""}. Costuma cair em minutos.`}
        footer={
          <Button type="button" block disabled={busy} onClick={() => void run(() => requestJson("/api/configuracoes/recebimento/saque", { method: "POST", body: JSON.stringify({}) }), "Saque pedido")}>
            Sacar tudo
          </Button>
        }
      >
        {error ? <FormAlert>{error}</FormAlert> : null}
      </Sheet>

      <Sheet
        open={sheet === "pix"}
        onClose={() => setSheet(null)}
        title="Chave Pix dos saques"
        description="CPF, CNPJ, e-mail, celular ou chave aleatória."
        footer={
          <Button type="button" block disabled={busy} onClick={() => void run(() => requestJson("/api/configuracoes/recebimento", { method: "PATCH", body: JSON.stringify({ payoutPixKey: newPix }) }), "Chave Pix salva")}>
            Salvar
          </Button>
        }
      >
        <div className={styles.stack}>
          <TextField label="Chave Pix" autoComplete="off" value={newPix} onChange={(event) => setNewPix(event.target.value)} />
          {error ? <FormAlert>{error}</FormAlert> : null}
        </div>
      </Sheet>
    </>
  );
}
