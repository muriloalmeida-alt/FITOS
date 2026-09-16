"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, FormAlert } from "@/shared/ui";
import type { StudentAccessStatus } from "@/modules/students/invitations";
import styles from "./ConviteSection.module.css";

const STATUS_LABEL: Record<StudentAccessStatus, string> = {
  NAO_CONVIDADO: "Não convidado",
  CONVITE_PENDENTE: "Convite pendente",
  CONVITE_EXPIRADO: "Convite expirado",
  CONVITE_CANCELADO: "Convite cancelado",
  CONTA_ATIVA: "Conta ativa",
};

interface ConviteSectionProps {
  studentId: string;
  accessStatus: StudentAccessStatus;
  /// Calculado no servidor (page.tsx), não aqui — evita chamar `Date.now()`
  /// durante a renderização do client component (impuro) e evita
  /// divergência entre o relógio do servidor e do navegador.
  diasRestantes: number | null;
}

/// Gerar, copiar, cancelar e renovar convite (FIT-015). O link com o token
/// bruto só existe no estado local desta sessão de navegador, logo após
/// gerar — nunca é recuperável depois (nem por este componente, nem pelo
/// servidor): atualizar a página faz o link desaparecer, sobrando apenas o
/// status. Isso é deliberado, não um bug.
export function ConviteSection({ studentId, accessStatus, diasRestantes }: ConviteSectionProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleGerar() {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    setCopied(false);
    const response = await fetch(`/api/students/${studentId}/convite`, { method: "POST" });
    setIsSubmitting(false);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.message ?? "Não foi possível gerar o convite. Tente novamente.");
      return;
    }

    const body = await response.json();
    setGeneratedLink(body.link);
    router.refresh();
  }

  async function handleCancelar() {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    const response = await fetch(`/api/students/${studentId}/convite`, { method: "DELETE" });
    setIsSubmitting(false);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.message ?? "Não foi possível cancelar o convite. Tente novamente.");
      return;
    }

    setGeneratedLink(null);
    router.refresh();
  }

  async function handleCopiar() {
    if (!generatedLink) return;
    try {
      await navigator.clipboard.writeText(generatedLink);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className={styles.section}>
      {error ? <FormAlert variant="error">{error}</FormAlert> : null}

      <p className={styles.statusLine}>
        Acesso: <strong>{STATUS_LABEL[accessStatus]}</strong>
        {accessStatus === "CONVITE_PENDENTE" && diasRestantes !== null ? ` — expira em ${diasRestantes} dia(s)` : null}
      </p>

      {generatedLink ? (
        <div className={styles.linkBox}>
          <input type="text" readOnly value={generatedLink} className={styles.linkInput} aria-label="Link de ativação" />
          <Button type="button" variant="outlined" onClick={handleCopiar}>
            {copied ? "Copiado!" : "Copiar link"}
          </Button>
        </div>
      ) : null}

      <div className={styles.actions}>
        {accessStatus === "NAO_CONVIDADO" || accessStatus === "CONVITE_EXPIRADO" || accessStatus === "CONVITE_CANCELADO" ? (
          <Button type="button" variant="filled" onClick={handleGerar} disabled={isSubmitting}>
            {isSubmitting ? "Gerando…" : "Gerar convite"}
          </Button>
        ) : null}

        {accessStatus === "CONVITE_PENDENTE" ? (
          <>
            <Button type="button" variant="filled" onClick={handleGerar} disabled={isSubmitting}>
              {isSubmitting ? "Gerando…" : "Gerar novo convite"}
            </Button>
            <Button type="button" variant="outlined" onClick={handleCancelar} disabled={isSubmitting}>
              Cancelar convite
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
