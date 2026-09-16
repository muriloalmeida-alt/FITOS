import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@/shared/ui";
import { appName } from "@/shared/config/env";
import { getServerSession } from "@/modules/identity/session";
import { LogoutButton } from "./LogoutButton";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: `Painel — ${appName}`,
};

/// Primeira página autenticada provisória (FIT-009): prova que a sessão é
/// acessível no servidor e que a rota é protegida. Não simula nenhuma
/// funcionalidade de negócio ainda não implementada — o shell completo de
/// personal/aluno, com navegação real, é escopo da FIT-012.
export default async function PainelPage() {
  const session = await getServerSession();

  if (!session) {
    redirect("/entrar");
  }

  return (
    <main className={styles.main}>
      <div className={styles.content}>
        <header className={styles.header}>
          <span className={styles.eyebrow}>Área autenticada — FIT-009</span>
          <h1 className={styles.title}>Olá, {session.user.name}</h1>
          <p className={styles.subtitle}>
            Esta página prova que a sessão do Better Auth é válida e acessível no servidor. A
            navegação completa (shell de personal/aluno) é entregue na FIT-012.
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

        <LogoutButton />
      </div>
    </main>
  );
}
