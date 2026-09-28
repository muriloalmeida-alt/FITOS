"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  CreditCardFields,
  EMPTY_CREDIT_CARD_FIELDS,
  FormAlert,
  validateCreditCardFields,
  type CreditCardFieldErrors,
  type CreditCardFieldsValue,
} from "@/shared/ui";
import styles from "./page.module.css";

interface CartaoFormProps {
  /// `null` quando nenhum cartão foi cadastrado ainda — nesse caso o
  /// formulário já aparece aberto (é o único jeito de completar o
  /// checkout, mesmo padrão do onboarding, FIT-128).
  creditCardLast4: string | null;
  creditCardBrand: string | null;
}

/// Cadastrar/atualizar o cartão fora do onboarding (FIT-128) — mesmo
/// checkout embutido, mesma rota (`/api/tenancy/minha-assinatura/cartao`),
/// reaproveitado aqui para quem: contratou um plano pago sem ter passado
/// pelo onboarding com essa etapa (conta antiga), trocou de um plano
/// grátis para um pago em `/painel/assinatura`, ou só precisa atualizar um
/// cartão vencido.
export function CartaoForm({ creditCardLast4, creditCardBrand }: CartaoFormProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(creditCardLast4 === null);
  const [card, setCard] = useState<CreditCardFieldsValue>(EMPTY_CREDIT_CARD_FIELDS);
  const [errors, setErrors] = useState<CreditCardFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    if (isSubmitting) {
      return;
    }
    const validationErrors = validateCreditCardFields(card);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    const response = await fetch("/api/tenancy/minha-assinatura/cartao", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(card),
    });
    setIsSubmitting(false);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setFormError(body?.message ?? "Não foi possível processar o cartão. Verifique os dados e tente novamente.");
      return;
    }

    setCard(EMPTY_CREDIT_CARD_FIELDS);
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <div>
        <p>
          Cartão terminado em <strong>{creditCardLast4}</strong> ({creditCardBrand})
        </p>
        <Button type="button" variant="outlined" onClick={() => setEditing(true)}>
          Atualizar cartão
        </Button>
      </div>
    );
  }

  return (
    <div className={styles.form}>
      {formError ? <FormAlert variant="error">{formError}</FormAlert> : null}
      <CreditCardFields value={card} onChange={setCard} errors={errors} />
      <div className={styles.actions}>
        {creditCardLast4 !== null ? (
          <button type="button" className={styles.backButton} onClick={() => setEditing(false)} disabled={isSubmitting}>
            Cancelar
          </button>
        ) : null}
        <Button type="button" variant="filled" onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? "Salvando…" : "Salvar cartão"}
        </Button>
      </div>
    </div>
  );
}
