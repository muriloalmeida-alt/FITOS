import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { getServerSession } from "@/modules/identity/session";
import { provisionTenantForCurrentSession } from "@/modules/tenancy/provisionTenant";
import { LogoutButton } from "./LogoutButton";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: `Painel — ${appName}`,
};

/// Primeira página autenticada provisória (FIT-009/FIT-010): prova que a
/// sessão é acessível no servidor, que a rota é protegida, e que o personal
/// possui exatamente um tenant (provisionado no cadastro; reparado aqui, de
/// forma idempotente, caso o provisionamento automático tenha falhado). Não
/// simula nenhuma funcionalidade de negócio ainda não implementada — o
/// shell completo de personal/aluno, com navegação real, é escopo da
/// FIT-012.
export default async function PainelPage() {
  const session = await getServerSession();

  if (!session) {
    redirect("/entrar");
  }

  const tenant = await provisionTenantForCurrentSession();

  return (
    <main className={styles.main}>
      <div className={styles.content}>
        <header className={styles.header}>
          <span className={styles.eyebrow}>Área autenticada — FIT-009/FIT-010</span>
          <h1 className={styles.title}>Olá, {session.user.name}</h1>
          <p className={styles.subtitle}>
            Esta página prova que a sessão do Better Auth é válida e acessível no servidor, e que
            o tenant do personal é provisionado automaticamente. A navegação completa (shell de
            personal/aluno) é entregue na FIT-012.
          </p>
        </header>

        <Card title="Sua sessão">
          <p>
            E-mail: <strong>{session.user.email}</strong>
          </p>
          <p>
            Papel: <strong>{session.user.role}</strong>
          </p>
        </Card>

        {tenant ? (
          <Card title="Seu espaço">
            <p>
              Nome: <strong>{tenant.name}</strong>
            </p>
          </Card>
        ) : null}

        <LogoutButton />
      </div>
    </main>
  );
}
