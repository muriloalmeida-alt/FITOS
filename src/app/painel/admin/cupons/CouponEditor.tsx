"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ChipGroup, FormAlert, Switch, TextField, WizardProgress } from "@/shared/ui";
import { COUPON_DURATIONS, couponSummary, formatCents, normalizeCouponCode } from "@/shared/lib/coupons";
import { CYCLE_LABEL, PRODUCT_LABEL, SEGMENT_HELP, SEGMENT_LABEL, dayOf, endAfterDayIso, startOfDayIso } from "./couponLabels";
import styles from "./coupons.module.css";

export interface EditorPlan {
  id: string;
  name: string;
  audience: "PERSONAL" | "INDIVIDUAL";
  billingCycle: "MENSAL" | "ANUAL";
  priceCents: number;
  active: boolean;
}

export interface EditorInitial {
  id: string;
  code: string;
  name: string;
  status: string;
  kind: "PERCENT" | "FIXED_AMOUNT";
  amount: number;
  durationCycles: number;
  stackable: boolean;
  products: ("PERSONAL" | "INDIVIDUAL")[];
  segments: string[];
  planIds: string[];
  cycles: ("MENSAL" | "ANUAL")[];
  startsAt: string | null;
  endsAt: string | null;
  maxRedemptions: number | null;
  budgetCents: number | null;
  note: string | null;
  selected: { tenantId: string; name: string; ownerEmail: string }[];
}

interface Preview {
  plans: { planId: string; name: string; baseCents: number; discountCents: number; finalCents: number }[];
  audienceCount: number;
  problems: string[];
}

interface Account {
  tenantId: string;
  name: string;
  ownerEmail: string;
}

const STEPS = ["Benefício", "Público", "Regras", "Revisão"] as const;

/// "20" → 2000 bps; "12,5" → 1250. Valor fixo "25,00" → 2500 centavos.
function toAmount(kind: "PERCENT" | "FIXED_AMOUNT", text: string): number | null {
  const value = Number(text.replace(/\./g, "").replace(",", "."));
  if (!text.trim() || !Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100);
}

function amountText(kind: "PERCENT" | "FIXED_AMOUNT", amount: number): string {
  return (amount / 100).toLocaleString("pt-BR", { minimumFractionDigits: kind === "FIXED_AMOUNT" ? 2 : 0, maximumFractionDigits: 2 });
}

function intOrNull(text: string): number | null {
  const value = Number(text);
  return text.trim() && Number.isInteger(value) && value > 0 ? value : null;
}

/// Nova campanha (ou edição): Benefício → Público → Regras → Revisão. A
/// revisão pede a prévia ao servidor (preço por plano, público estimado e
/// o que impede ativar); salvar grava em rascunho ou cria nova versão.
export function CouponEditor({ plans, initial }: { plans: EditorPlan[]; initial?: EditorInitial }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [code, setCode] = useState(initial?.code ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [kind, setKind] = useState<"PERCENT" | "FIXED_AMOUNT">(initial?.kind ?? "PERCENT");
  const [amount, setAmount] = useState(initial ? amountText(initial.kind, initial.amount) : "");
  const [duration, setDuration] = useState(String(initial?.durationCycles ?? 3));
  const [stackable, setStackable] = useState(initial?.stackable ?? false);
  const [products, setProducts] = useState<("PERSONAL" | "INDIVIDUAL")[]>(initial?.products ?? ["PERSONAL"]);
  const [segments, setSegments] = useState<string[]>(initial?.segments ?? ["NOVOS"]);
  const [selected, setSelected] = useState<Account[]>(initial?.selected ?? []);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Account[]>([]);
  const [planIds, setPlanIds] = useState<string[]>(initial?.planIds ?? []);
  const [cycles, setCycles] = useState<("MENSAL" | "ANUAL")[]>(initial?.cycles ?? ["MENSAL"]);
  const [startDay, setStartDay] = useState(dayOf(initial?.startsAt ?? null));
  const [endDay, setEndDay] = useState(dayOf(initial?.endsAt ?? null, true));
  const [maxRedemptions, setMaxRedemptions] = useState(initial?.maxRedemptions ? String(initial.maxRedemptions) : "");
  const [budget, setBudget] = useState(initial?.budgetCents ? amountText("FIXED_AMOUNT", initial.budgetCents) : "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selectedOnly = segments.includes("SELECIONADOS");
  const visiblePlans = plans.filter((plan) => products.includes(plan.audience) && plan.priceCents > 0);
  const amountValue = toAmount(kind, amount);

  function payload() {
    return {
      code,
      name,
      kind,
      amount: amountValue,
      durationCycles: Number(duration),
      stackable,
      products,
      segments,
      selectedTenantIds: selectedOnly ? selected.map((account) => account.tenantId) : [],
      planIds: planIds.filter((id) => visiblePlans.some((plan) => plan.id === id)),
      cycles,
      startsAt: startDay ? startOfDayIso(startDay) : null,
      endsAt: endDay ? endAfterDayIso(endDay) : null,
      maxRedemptions: intOrNull(maxRedemptions),
      budgetCents: budget ? toAmount("FIXED_AMOUNT", budget) : null,
      note,
    };
  }

  function validate(): string | null {
    if (step === 0) {
      if (!initial && !normalizeCouponCode(code)) return "Código: de 3 a 32 caracteres, só letras, números e hífen.";
      if (!name.trim()) return "Dê um nome interno à campanha.";
      if (!amountValue) return kind === "PERCENT" ? "Informe o percentual." : "Informe o valor do desconto.";
      if (kind === "PERCENT" && amountValue > 10_000) return "Percentual entre 0,01% e 100%.";
    }
    if (step === 1) {
      if (products.length === 0) return "Escolha o produto.";
      if (segments.length === 0) return "Escolha o público.";
      if (selectedOnly && selected.length === 0) return "Escolha pelo menos uma conta.";
    }
    if (step === 2) {
      if (payload().planIds.length === 0) return "Escolha pelo menos um plano.";
      if (cycles.length === 0) return "Escolha o ciclo.";
      if (startDay && endDay && endDay < startDay) return "O último dia precisa ser depois do início.";
    }
    return null;
  }

  async function next() {
    const problem = validate();
    setError(problem);
    if (problem) return;
    if (step < 2) return setStep(step + 1);
    setBusy(true);
    const response = await fetch("/api/admin/cupons/previa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload()) }).catch(() => null);
    const body = await response?.json().catch(() => null);
    setBusy(false);
    if (!response?.ok) return setError(body?.message ?? "Não foi possível calcular a prévia.");
    setPreview(body as Preview);
    setStep(3);
  }

  async function save() {
    setBusy(true);
    setError(null);
    const response = await fetch(initial ? `/api/admin/cupons/${initial.id}` : "/api/admin/cupons", {
      method: initial ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload()),
    }).catch(() => null);
    const body = await response?.json().catch(() => null);
    if (!response?.ok) {
      setBusy(false);
      return setError(body?.message ?? "Não foi possível salvar. Tente de novo.");
    }
    router.push(`/painel/admin/cupons/${initial?.id ?? body.id}`);
    router.refresh();
  }

  async function find(term: string) {
    setSearch(term);
    if (term.trim().length < 2) return setResults([]);
    const response = await fetch(`/api/admin/cupons/contas?q=${encodeURIComponent(term)}&produtos=${products.join(",")}`).catch(() => null);
    const body = response?.ok ? ((await response.json()) as { accounts: Account[] }) : { accounts: [] };
    setResults(body.accounts);
  }

  function chooseSegments(value: string[]) {
    const added = value.find((segment) => !segments.includes(segment));
    // Selecionados não se combina com os demais (ADR-021).
    setSegments(added === "SELECIONADOS" ? ["SELECIONADOS"] : value.filter((segment) => segment !== "SELECIONADOS" || !added));
  }

  return (
    <section className={styles.editor} aria-label={initial ? "Editar cupom" : "Novo cupom"}>
      <WizardProgress step={step + 1} totalSteps={STEPS.length} />
      <p className={styles.eyebrow}>
        {String(step + 1).padStart(2, "0")} / {STEPS[step]}
        {initial && initial.status !== "DRAFT" ? " · as mudanças valem para novos resgates (nova versão)" : ""}
      </p>

      {step === 0 ? (
        <div className={styles.form}>
          <TextField label="Código" name="code" value={code} disabled={Boolean(initial)} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="Ex.: VOLTA20" autoCapitalize="characters" />
          <TextField label="Nome interno" name="name" value={name} maxLength={80} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Reativação de outubro" />
          <ChipGroup label="Tipo de desconto" showLabel value={kind} onChange={(value) => setKind(value)} options={[{ value: "PERCENT", label: "Percentual" }, { value: "FIXED_AMOUNT", label: "Valor fixo" }]} />
          <TextField label={kind === "PERCENT" ? "Percentual (%)" : "Valor (R$)"} name="amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder={kind === "PERCENT" ? "20" : "25,00"} />
          <ChipGroup label="Duração (cobranças com desconto)" showLabel value={duration} onChange={setDuration} options={COUPON_DURATIONS.map((value) => ({ value: String(value), label: value === 1 ? "1 ciclo" : `${value} ciclos` }))} />
          <Switch label="Acumulável" description="Pode ser usado junto com no máximo 1 outro cupom acumulável." checked={stackable} onChange={setStackable} />
        </div>
      ) : null}

      {step === 1 ? (
        <div className={styles.form}>
          <ChipGroup<"PERSONAL" | "INDIVIDUAL"> label="Produto" showLabel multiple value={products} onChange={(value) => setProducts(value)} options={[{ value: "PERSONAL", label: PRODUCT_LABEL.PERSONAL }, { value: "INDIVIDUAL", label: PRODUCT_LABEL.INDIVIDUAL }]} />
          <ChipGroup label="Público" showLabel multiple variant="card" value={segments} onChange={chooseSegments} options={["NOVOS", "INATIVOS", "ATIVOS", "SELECIONADOS"].map((value) => ({ value, label: SEGMENT_LABEL[value], description: SEGMENT_HELP[value] }))} />
          <p className={styles.muted}>Inadimplentes não entram em nenhum público. Aluno de personal nunca recebe cupom do FitOS.</p>
          {selectedOnly ? (
            <>
              <TextField label="Buscar conta (nome do espaço ou e-mail)" name="search" value={search} onChange={(event) => void find(event.target.value)} />
              {results.length ? (
                <ul className={styles.picker} aria-label="Contas encontradas">
                  {results.map((account) => (
                    <li key={account.tenantId}>
                      <button type="button" disabled={selected.some((item) => item.tenantId === account.tenantId)} onClick={() => setSelected((current) => [...current, account])}>
                        <strong>{account.name}</strong> <span>{account.ownerEmail}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <ul className={styles.picked} aria-label="Contas escolhidas">
                {selected.map((account) => (
                  <li key={account.tenantId}>
                    <span>
                      <strong>{account.name}</strong> {account.ownerEmail}
                    </span>
                    <button type="button" aria-label={`Tirar ${account.name}`} onClick={() => setSelected((current) => current.filter((item) => item.tenantId !== account.tenantId))}>
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}

      {step === 2 ? (
        <div className={styles.form}>
          <ChipGroup
            label="Planos"
            showLabel
            multiple
            variant="card"
            columns={1}
            value={planIds}
            onChange={setPlanIds}
            options={visiblePlans.map((plan) => ({ value: plan.id, label: plan.name, description: `${PRODUCT_LABEL[plan.audience]} · ${formatCents(plan.priceCents)} ${plan.billingCycle === "ANUAL" ? "por ano" : "por mês"}${plan.active ? "" : " · retirado"}` }))}
          />
          <ChipGroup<"MENSAL" | "ANUAL"> label="Ciclo" showLabel multiple value={cycles} onChange={(value) => setCycles(value)} options={[{ value: "MENSAL", label: CYCLE_LABEL.MENSAL }, { value: "ANUAL", label: CYCLE_LABEL.ANUAL }]} />
          <div className={styles.two}>
            <TextField label="Resgate a partir de" name="startDay" type="date" value={startDay} onChange={(event) => setStartDay(event.target.value)} />
            <TextField label="Último dia para resgatar" name="endDay" type="date" value={endDay} onChange={(event) => setEndDay(event.target.value)} />
          </div>
          <div className={styles.two}>
            <TextField label="Limite de contas" name="maxRedemptions" inputMode="numeric" value={maxRedemptions} onChange={(event) => setMaxRedemptions(event.target.value.replace(/\D/g, ""))} placeholder="Sem limite" />
            <TextField label="Orçamento (R$)" name="budget" inputMode="decimal" value={budget} onChange={(event) => setBudget(event.target.value)} placeholder="Sem teto" />
          </div>
          <TextField label="Observação (opcional)" name="note" value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} />
        </div>
      ) : null}

      {step === 3 && preview ? (
        <div className={styles.form}>
          <div className={styles.card}>
            <strong>{normalizeCouponCode(code) ?? code}</strong>
            <span>{couponSummary({ kind, amount: amountValue ?? 0, durationCycles: Number(duration) })}</span>
            <span className={styles.muted}>É o texto que a conta vê ao aplicar o cupom.</span>
          </div>
          <table className={styles.table}>
            <caption>Preço por plano</caption>
            <thead>
              <tr>
                <th scope="col">Plano</th>
                <th scope="col">Hoje</th>
                <th scope="col">Desconto</th>
                <th scope="col">Com cupom</th>
              </tr>
            </thead>
            <tbody>
              {preview.plans.map((plan) => (
                <tr key={plan.planId}>
                  <th scope="row">{plan.name}</th>
                  <td>{formatCents(plan.baseCents)}</td>
                  <td>−{formatCents(plan.discountCents)}</td>
                  <td>
                    <strong>{formatCents(plan.finalCents)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            <strong>{preview.audienceCount}</strong> {preview.audienceCount === 1 ? "conta está" : "contas estão"} hoje no público (estimativa, não é envio).
          </p>
          {preview.problems.length ? (
            <FormAlert variant="info">
              Para ativar, resolva: {preview.problems.join(" ")} Você pode salvar o rascunho mesmo assim.
            </FormAlert>
          ) : null}
          <p className={styles.muted}>Salvar não envia nada a ninguém. A campanha só aceita resgates depois de ativada.</p>
        </div>
      ) : null}

      {error ? <FormAlert variant="error">{error}</FormAlert> : null}

      <div className={styles.actions}>
        {step < 3 ? (
          <Button type="button" size="lg" block onClick={() => void next()} disabled={busy}>
            {step === 2 ? (busy ? "Calculando…" : "Revisar") : "Continuar"}
          </Button>
        ) : (
          <Button type="button" size="lg" block onClick={() => void save()} disabled={busy}>
            {busy ? "Salvando…" : initial ? "Salvar alterações" : "Salvar rascunho"}
          </Button>
        )}
        {step > 0 ? (
          <Button type="button" variant="quiet" block onClick={() => setStep(step - 1)} disabled={busy}>
            Voltar
          </Button>
        ) : null}
      </div>
    </section>
  );
}
