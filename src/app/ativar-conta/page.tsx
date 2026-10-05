import type { Metadata } from "next";
import { appName } from "@/shared/config/env";
import { ActionRow, Avatar, Button } from "@/shared/ui";
import { checkActivationToken, type InvalidInvitationReason } from "@/modules/identity/activation";
import { EntradaShell } from "../_entrada/EntradaShell";
import styles from "../_entrada/Entrada.module.css";
import { AtivarContaForm } from "./AtivarContaForm";

export const metadata: Metadata = {
  title: `Ativar convite — ${appName}`,
  description: "Ative seu acesso ao FitOS a partir do convite do seu personal.",
};

const REASON: Record<InvalidInvitationReason, { title: string; text: string }> = {
  INVALIDO: { title: "Convite inválido", text: "Confira se o link está completo ou peça um novo ao seu personal." },
  EXPIRADO: { title: "Convite expirado", text: "Convites valem 7 dias. Peça um novo ao seu personal." },
  CANCELADO: { title: "Convite cancelado", text: "Peça um novo ao seu personal." },
  USADO: { title: "Convite já usado", text: "Se a conta é sua, é só entrar." },
  CONTA_EXISTENTE: { title: "Você já tem conta", text: "Entre com seu e-mail e cole este convite no Início para treinar com seu personal." },
};

/// Ativar convite (FIT-165, E4 do protótipo): quem convidou, e-mail fixo e
/// só a senha. Convite que não serve mais mostra o motivo e as saídas
/// "Já tenho conta" e "Treinar por conta própria". A validação real e
/// atômica continua no envio (`activateStudentAccount`).
export default async function AtivarContaPage({ searchParams }: { searchParams?: Promise<{ token?: string }> } = {}) {
  const { token } = (await searchParams) ?? {};
  const check = token ? await checkActivationToken(token) : { valid: false as const, reason: "INVALIDO" as const };

  if (!check.valid || !token) {
    const info = REASON[check.reason ?? "INVALIDO"];
    return (
      <EntradaShell>
        <div>
          <p className={styles.eyebrow}>Convite</p>
          <h1 className={styles.title}>{info.title}</h1>
          <p className={styles.lead}>{info.text}</p>
        </div>
        <div className={styles.alt}>
          <Button href="/entrar" size="lg" block>
            Já tenho conta
          </Button>
          <Button href="/comecar?caminho=livre" variant="secondary" block>
            Treinar por conta própria
          </Button>
        </div>
      </EntradaShell>
    );
  }

  const first = check.studentName?.split(/\s+/)[0] ?? "";
  return (
    <EntradaShell>
      <div>
        <p className={styles.eyebrow}>Você foi convidado</p>
        <h1 className={styles.title}>Oi, {first}.</h1>
      </div>
      <ActionRow leading={<Avatar name={check.personalName ?? ""} />} title={check.personalName} description={`${check.businessName} te convidou para treinar no ${appName}`} />
      <AtivarContaForm token={token} email={check.email ?? ""} />
    </EntradaShell>
  );
}
