"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo, Button } from "@/shared/ui";
import { allowedWhenBlocked } from "@/modules/billing/access";
import { LogoutButton } from "./LogoutButton";
import styles from "./SubscriptionGate.module.css";

const dayMonth = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });

/// Fim do teste grátis sem cartão (EPIC-38): na carência, uma faixa em
/// todas as telas; no bloqueio, só Assinatura, Perfil e Configurações
/// abrem; o resto mostra o caminho para cadastrar o cartão.
export function SubscriptionGate({ state, personal, children }: { state: { kind: "CARENCIA" | "BLOQUEADO"; dateIso: string }; personal: boolean; children: ReactNode }) {
  const pathname = usePathname() ?? "/painel";

  if (state.kind === "CARENCIA") {
    return (
      <>
        <Link href="/painel/assinatura" className={styles.bar} role="status">
          Seu teste grátis acabou. Cadastre o cartão até {dayMonth.format(new Date(state.dateIso))} para não perder o acesso. <strong>Cadastrar</strong>
        </Link>
        {children}
      </>
    );
  }

  if (allowedWhenBlocked(pathname)) return <>{children}</>;

  return (
    <main className={styles.blocked}>
      <BrandLogo background="photo" size={44} />
      <div className={styles.text}>
        <p className={styles.eyebrow}>Teste grátis encerrado</p>
        <h1 className={styles.title}>Cadastre o cartão para continuar</h1>
        <p className={styles.muted}>
          {personal
            ? "Seus alunos continuam treinando normalmente. Seus programas, alunos e cobranças estão guardados e voltam assim que o cartão for cadastrado."
            : "Seus treinos e sua evolução estão guardados e voltam assim que o cartão for cadastrado."}
        </p>
      </div>
      <div className={styles.actions}>
        <Button href="/painel/assinatura" size="lg" block>
          Cadastrar cartão
        </Button>
        {personal ? (
          <Button href="/painel/configuracoes" variant="quiet" block>
            Baixar meus dados ou excluir a conta
          </Button>
        ) : (
          <Button href="/painel/perfil" variant="quiet" block>
            Meu perfil
          </Button>
        )}
        <LogoutButton block />
      </div>
    </main>
  );
}
